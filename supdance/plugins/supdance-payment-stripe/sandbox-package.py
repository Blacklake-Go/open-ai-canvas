"""Create the isolated sandbox companion from a built Stripe plugin package."""

import argparse
import json
import tempfile
from pathlib import Path
from zipfile import ZipFile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.package.resolve() == args.output.resolve():
        parser.error("sandbox output must differ from the source package")

    with ZipFile(args.package) as source:
        manifest = json.loads(source.read("manifest.json"))
        provider, = manifest["contributes"]["paymentProviders"]
        if manifest["id"] != "supdance-payment-stripe" or provider["id"] != "stripe":
            parser.error("source must be the regular SupDance Stripe package")
        manifest.update(id="supdance-payment-stripe-sandbox", name="Stripe Sandbox")
        provider.update(id="stripe-sandbox", label="Stripe Sandbox")
        mode = next(field for field in manifest["configuration"]["fields"] if field["name"] == "mode")
        mode.update(default="test", values=["test"])

        with tempfile.TemporaryDirectory(dir=args.output.parent) as working_directory:
            output = Path(working_directory) / args.output.name
            with ZipFile(output, "w") as package:
                for member in source.infolist():
                    contents = json.dumps(manifest, ensure_ascii=False, indent=2).encode() if member.filename == "manifest.json" else source.read(member)
                    package.writestr(member, contents)
            output.replace(args.output)


if __name__ == "__main__":
    main()
