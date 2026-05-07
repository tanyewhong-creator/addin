"""Allow `python -m addin.cli` invocation."""

import sys

from addin.cli import main

if __name__ == "__main__":
    sys.exit(main() or 0)
