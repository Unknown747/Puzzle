_btc_hunt_complete() {
  local cur prev cmds flags
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  cmds="hunt auto scrape watch list verify help"

  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )
    return 0
  fi

  case "${COMP_WORDS[1]}" in
    hunt)
      flags="--puzzle --strategy --workers --duration --address-mode --mbaby --no-resume"
      case "$prev" in
        --strategy) COMPREPLY=( $(compgen -W "random sequential stride combined" -- "$cur") ); return 0 ;;
        --address-mode) COMPREPLY=( $(compgen -W "compressed both" -- "$cur") ); return 0 ;;
        --puzzle)
          local nums
          nums=$(node -e "console.log(JSON.parse(require('fs').readFileSync('data/puzzles.json')).filter(p=>p.status==='open').map(p=>p.puzzle).join(' '))" 2>/dev/null)
          COMPREPLY=( $(compgen -W "$nums" -- "$cur") ); return 0 ;;
      esac
      COMPREPLY=( $(compgen -W "$flags" -- "$cur") ) ;;
    auto)
      flags="--rotate --strategy --workers --duration --address-mode --no-resume"
      case "$prev" in
        --strategy) COMPREPLY=( $(compgen -W "random sequential stride combined" -- "$cur") ); return 0 ;;
        --address-mode) COMPREPLY=( $(compgen -W "compressed both" -- "$cur") ); return 0 ;;
      esac
      COMPREPLY=( $(compgen -W "$flags" -- "$cur") ) ;;
    scrape)
      COMPREPLY=( $(compgen -W "--concurrency" -- "$cur") ) ;;
  esac
}
complete -F _btc_hunt_complete btc-hunt
