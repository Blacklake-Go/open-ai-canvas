#!/bin/sh
set -eu
cd "$(dirname "$0")"
node --test backend/rpc.test.cjs
python3 - <<'PY'
import hashlib
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path.cwd()
output = root.parents[2] / '.local/cache/waffo-pancake'
output.mkdir(parents=True, exist_ok=True)
package = output / 'supdance-payment-waffo.yingce-plugin'
with ZipFile(package, 'w') as archive:
    for name in ['manifest.json', 'README.md', 'LICENSE', 'backend/provider', 'backend/rpc.cjs']:
        entry = ZipInfo(name, date_time=(2026, 11, 12, 0, 0, 0))
        entry.create_system = 3
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = (0o100755 if name == 'backend/provider' else 0o100644) << 16
        archive.writestr(entry, (root / name).read_bytes())
print(f'{hashlib.sha256(package.read_bytes()).hexdigest()}  {package}')
PY
