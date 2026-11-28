import io, os, re, sys

# Scan non-test .tsx under the given root for print-clipping risks.
#
# TWO rules, both learned from a reviewer falsifying an earlier version of this script:
#
# 1. BLOCK-AWARE comment exclusion. The first version skipped a line only if its FIRST non-space
#    characters looked like a comment opener. That misses continuation lines -- and a real comment
#    written ABOUT the word `truncate` had a continuation line starting with a backtick, which was
#    counted. So a doc comment inflated the very figure whose stated purpose was to be immune to
#    doc comments. This version tracks /* */ and {/* */} block state across lines.
#
# 2. CLASS CONTEXT for the horizontal axis. `truncate` is also an ordinary identifier: TelemetrySidebar
#    declares `function truncate(value, length)` and calls it twice. Those are not Tailwind classes and
#    must not be counted as clipping risks. A horizontal hit counts only on a line that also carries a
#    class context (className=, class=, or cn().
#
# Known limit, stated because this script's whole job is to produce a number someone else can
# reproduce: a class list composed across MULTIPLE lines inside cn(...) is only counted on the lines
# that carry the token, and a horizontal token on a continuation line of such a call is missed.
root = sys.argv[1] if len(sys.argv) > 1 else 'src'
capre = re.compile(r'max-h-\[[^\]]*\]|max-h-[a-zA-Z0-9]+')
horiz = re.compile(r'\btruncate\b|\bline-clamp-[0-9]+\b')
classctx = re.compile(r'className\s*=|class\s*=|cn\(')
line_comment = re.compile(r'^\s*(//|\*|<!--)')

def strip_and_track(line, in_block):
    """Return (code_part, in_block_after). Removes /* */ and {/* */} spans."""
    out = []
    i = 0
    while i < len(line):
        if in_block:
            end = line.find('*/', i)
            if end == -1:
                return ''.join(out), True
            i = end + 2
            in_block = False
        else:
            start = line.find('/*', i)
            if start == -1:
                out.append(line[i:])
                return ''.join(out), False
            out.append(line[i:start])
            i = start + 2
            in_block = True
    return ''.join(out), in_block

vert, horz = [], []
for dp, dn, fn in os.walk(root):
    for f in fn:
        if not f.endswith('.tsx'):
            continue
        p = os.path.join(dp, f)
        if '__tests__' in p:
            continue
        norm = p.replace(os.sep, '/')
        in_block = False
        for i, raw in enumerate(io.open(p, encoding='utf-8', errors='replace'), 1):
            code, in_block = strip_and_track(raw, in_block)
            if line_comment.match(raw) or not code.strip():
                continue
            caps = [c for c in capre.findall(code) if c != 'max-h-none']
            if caps and 'print:max-h-none' not in code:
                vert.append((norm, i, ' '.join(sorted(set(caps)))))
            if horiz.search(code) and classctx.search(code):
                horz.append((norm, i, ' '.join(sorted(set(horiz.findall(code))))))

print('UN-RESET VERTICAL CAP LINES: %d' % len(vert))
print('HORIZONTAL CLIP LINES:       %d' % len(horz))
print('VERTICAL CAP TOKENS:         %d' % sum(len(r[2].split()) for r in vert))
if '-v' in sys.argv:
    for r in vert:
        print('  V %s:%d  %s' % r)
    for r in horz:
        print('  H %s:%d  %s' % r)
