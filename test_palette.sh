grep -rn "<button" src/components/ | grep -v aria-label | grep -E "svg|<path|icon"
