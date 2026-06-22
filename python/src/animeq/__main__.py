"""Allow `python -m animeq` / jurigged `-m animeq`."""
import sys

from animeq import main

if __name__ == "__main__":
    sys.exit(main())
