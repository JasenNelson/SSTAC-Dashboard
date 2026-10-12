param(
  [Parameter(Mandatory)][string]$Executable,
  [Parameter(Mandatory)][string]$ArgumentsBase64
)

$ErrorActionPreference = 'Stop'
$argsList = [System.Text.Json.JsonSerializer]::Deserialize(
  [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($ArgumentsBase64)),
  [string[]]
)

# Create the child suspended, assign it to a kill-on-close Windows Job Object,
# then resume it. This closes the parent-exit gap in taskkill /T: descendants
# stay owned even if the direct Next or Playwright process exits first.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class NativeLocalJob {
  [StructLayout(LayoutKind.Sequential)] public struct BasicLimit {
    public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] public struct IoCounters {
    public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
    public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)] public struct ExtendedLimit {
    public BasicLimit BasicLimitInformation;
    public IoCounters IoInfo;
    public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
  }
  [StructLayout(LayoutKind.Sequential)] public struct BasicAccounting {
    public long TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
    public uint TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
  }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct StartupInfo {
    public uint cb;
    public IntPtr lpReserved, lpDesktop, lpTitle;
    public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars;
    public uint dwFillAttribute, dwFlags;
    public ushort wShowWindow, cbReserved2;
    public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] public struct ProcessInfo {
    public IntPtr hProcess, hThread;
    public uint dwProcessId, dwThreadId;
  }
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool CreateProcess(string application, StringBuilder command, IntPtr processAttributes,
    IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment,
    string currentDirectory, ref StartupInfo startup, out ProcessInfo process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimit info, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int infoClass, out BasicAccounting info, uint length, IntPtr returned);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GetStdHandle(int kind);

  static string Quote(string value) {
    if (value.Length > 0 && value.IndexOfAny(new char[] {' ', '\t', '"'}) < 0) return value;
    var result = new StringBuilder("\"");
    int slashes = 0;
    foreach (char ch in value) {
      if (ch == '\\') { slashes++; continue; }
      if (ch == '"') { result.Append('\\', slashes * 2 + 1); result.Append('"'); slashes = 0; continue; }
      result.Append('\\', slashes); slashes = 0; result.Append(ch);
    }
    result.Append('\\', slashes * 2); result.Append('"');
    return result.ToString();
  }
  static void Require(bool ok, string code) {
    if (!ok) throw new Exception(code + "_WIN32_" + Marshal.GetLastWin32Error());
  }
  public static int Run(string executable, string[] arguments) {
    IntPtr job = IntPtr.Zero;
    ProcessInfo process = new ProcessInfo();
    bool created = false, assigned = false;
    try {
      job = CreateJobObject(IntPtr.Zero, null);
      Require(job != IntPtr.Zero, "NATIVE_JOB_CREATE_FAILED");
      var limits = new ExtendedLimit();
      limits.BasicLimitInformation.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
      Require(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf<ExtendedLimit>()), "NATIVE_JOB_LIMIT_FAILED");
      var startup = new StartupInfo();
      startup.cb = (uint)Marshal.SizeOf<StartupInfo>();
      startup.dwFlags = 0x100; // STARTF_USESTDHANDLES
      startup.hStdInput = GetStdHandle(-10);
      startup.hStdOutput = GetStdHandle(-11);
      startup.hStdError = GetStdHandle(-12);
      var command = new StringBuilder(Quote(executable));
      foreach (var argument in arguments) command.Append(' ').Append(Quote(argument));
      Require(CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true,
        0x00000004 | 0x08000000, IntPtr.Zero, Environment.CurrentDirectory,
        ref startup, out process), "NATIVE_JOB_PROCESS_FAILED");
      created = true;
      Require(AssignProcessToJobObject(job, process.hProcess), "NATIVE_JOB_ASSIGN_FAILED");
      assigned = true;
      Require(ResumeThread(process.hThread) != 0xffffffff, "NATIVE_JOB_RESUME_FAILED");
      Console.WriteLine("NATIVE_JOB_CHILD_STARTED");
      Require(WaitForSingleObject(process.hProcess, 0xffffffff) == 0, "NATIVE_JOB_WAIT_FAILED");
      uint exitCode;
      Require(GetExitCodeProcess(process.hProcess, out exitCode), "NATIVE_JOB_EXIT_UNKNOWN");
      return unchecked((int)exitCode);
    } finally {
      if (created && !assigned) TerminateProcess(process.hProcess, 1);
      if (assigned) {
        Require(TerminateJobObject(job, 1), "NATIVE_JOB_TERMINATE_FAILED");
        bool drained = false;
        for (int i = 0; i < 100; i++) {
          BasicAccounting accounting;
          Require(QueryInformationJobObject(job, 1, out accounting, (uint)Marshal.SizeOf<BasicAccounting>(), IntPtr.Zero), "NATIVE_JOB_QUERY_FAILED");
          if (accounting.ActiveProcesses == 0) { drained = true; break; }
          Thread.Sleep(50);
        }
        Require(drained, "NATIVE_JOB_NOT_DRAINED");
        Console.WriteLine("NATIVE_JOB_DRAINED");
      }
      if (process.hThread != IntPtr.Zero) CloseHandle(process.hThread);
      if (process.hProcess != IntPtr.Zero) CloseHandle(process.hProcess);
      if (job != IntPtr.Zero) CloseHandle(job);
    }
  }
}
'@

try {
  exit [NativeLocalJob]::Run($Executable, $argsList)
} catch {
  [Console]::Error.WriteLine('NATIVE_JOB_FAILURE')
  exit 1
}
