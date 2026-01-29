import argparse
import csv
import time
import urllib.request
import urllib.error
from pathlib import Path

DEFAULT_INPUT = r"F:\sstac-dashboard\scripts\regulatory-review\data\policy_sources.csv"
DEFAULT_OUTPUT = r"F:\sstac-dashboard\scripts\regulatory-review\data\policy_url_checks.csv"


def check_url(url: str, timeout: float) -> tuple[int | None, str, str]:
    if not url:
        return None, '', 'EMPTY'

    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.geturl(), ''
    except Exception:
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                return resp.status, resp.geturl(), ''
        except urllib.error.HTTPError as e:
            final_url = e.geturl() if hasattr(e, 'geturl') else url
            return e.code, final_url, f"HTTPError {e.code}"
        except Exception as e:
            return None, url, f"ERROR {type(e).__name__}"


def main() -> None:
    parser = argparse.ArgumentParser(description='Validate policy source URLs and output a CSV report.')
    parser.add_argument('--input', default=DEFAULT_INPUT, help='Policy sources CSV path')
    parser.add_argument('--output', default=DEFAULT_OUTPUT, help='Output CSV path')
    parser.add_argument('--timeout', type=float, default=15, help='Request timeout seconds')
    parser.add_argument('--sleep', type=float, default=0.1, help='Sleep between requests')
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"Input CSV not found: {input_path}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with input_path.open('r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    fieldnames = [
        'source_id',
        'url_type',
        'url',
        'status',
        'final_url',
        'error',
    ]

    with output_path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in rows:
            source_id = row.get('source_id', '')
            for url_type in ('document_url', 'landing_page_url'):
                url = row.get(url_type, '') or ''
                status, final_url, error = check_url(url, args.timeout)
                writer.writerow({
                    'source_id': source_id,
                    'url_type': url_type,
                    'url': url,
                    'status': status if status is not None else '',
                    'final_url': final_url,
                    'error': error,
                })
                time.sleep(args.sleep)

    print(f"Wrote {output_path}")


if __name__ == '__main__':
    main()
