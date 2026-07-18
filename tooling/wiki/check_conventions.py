import sys
import re
from pathlib import Path

def main():
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent

    # File paths
    conventions_path = script_dir / "conventions.md"
    scripts = {
        "wiki_compile.py": script_dir / "wiki_compile.py",
        "wiki_lint.py": script_dir / "wiki_lint.py",
        "promotion.py": script_dir / "promotion.py",
        "session_bootstrap.py": script_dir / "session_bootstrap.py"
    }

    if not conventions_path.exists():
        print(f"Error: Conventions document not found at {conventions_path}")
        sys.exit(1)

    conventions_content = conventions_path.read_text(encoding='utf-8')

    # Define the constants we expect to find in both the scripts and conventions.md
    expected_constants = [
        # Wikilink patterns
        r"\[\[(.*?)\]\]",
        # Index filenames
        "000-Modules",
        "000-Concepts",
        # Tiers / Confidence levels
        "EXTRACTED",
        "INFERRED",
        "AMBIGUOUS",
        # Promotion states
        "inferred",
        "promoted",
        "demoted",
        "retired"
    ]

    missing_in_conventions = []
    missing_in_scripts = []

    # Check conventions.md
    for const in expected_constants:
        if const not in conventions_content and not re.search(re.escape(const), conventions_content):
            if const == r"\[\[(.*?)\]\]" and (r"\[\[(.*?)\]\]" in conventions_content or "[[.*?" in conventions_content):
                continue
            missing_in_conventions.append(const)

    # Check scripts
    script_contents = {}
    for name, path in scripts.items():
        if path.exists():
            script_contents[name] = path.read_text(encoding='utf-8')
        else:
            print(f"Warning: Script {name} not found at {path}")

    for const in expected_constants:
        found_in_any = False
        for name, content in script_contents.items():
            if const in content or re.search(re.escape(const), content):
                found_in_any = True
                break
            if const == r"\[\[(.*?)\]\]" and (r"\[\[(.*?)\]\]" in content or r"\[\[([^\]]+)\]\]" in content):
                found_in_any = True
                break
        if not found_in_any:
            missing_in_scripts.append(const)

    has_error = False
    if missing_in_conventions:
        print("Error: The following constants are missing in conventions.md:")
        for m in missing_in_conventions:
            print(f"  - {m}")
        has_error = True

    if missing_in_scripts:
        print("Error: The following constants were defined but not found in any wiki scripts:")
        for m in missing_in_scripts:
            print(f"  - {m}")
        has_error = True

    if has_error:
        sys.exit(1)
    else:
        print("OK: All conventions and constants verified successfully.")
        sys.exit(0)

if __name__ == '__main__':
    main()
