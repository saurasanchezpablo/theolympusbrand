# The Olympus — a bash prompt in the house's greys, with gold and rosso antico.
#
#   ▲ host ~/where/you/are · branch ✕ 1
#   ❯
#
# The mountain, the host, the folder and the git branch (in gold); a failed
# command's exit code after a ✕ (in red, and a sign as well, for any eyes);
# # instead of ❯ as root.

__olympus_git() {
  local b
  b=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null) || return 0
  printf ' · %s' "$b"
}

__olympus_prompt() {
  local status=$?
  local quiet='\[\e[38;2;122;122;122m\]' text='\[\e[38;2;201;201;201m\]' strong='\[\e[38;2;250;250;250m\]' branch='\[\e[38;2;201;165;94m\]' failure='\[\e[38;2;227;144;127m\]' off='\[\e[0m\]'
  local mark='❯' failed=''
  [ "${EUID:-$(id -u)}" -eq 0 ] && mark='#'
  [ "$status" -ne 0 ] && failed=" ${failure}✕ ${status}${off}"
  # The branch is printed when the prompt is shown, never expanded again: a branch name cannot run code.
  PS1="\n${quiet}▲${off} ${strong}\h${off} ${text}\w${off}${branch}"'$(__olympus_git)'"${off}${failed}\n${strong}${mark}${off} "
  return "$status"
}

case ";${PROMPT_COMMAND:-};" in
  *";__olympus_prompt;"*) ;;
  *) PROMPT_COMMAND="__olympus_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
esac
