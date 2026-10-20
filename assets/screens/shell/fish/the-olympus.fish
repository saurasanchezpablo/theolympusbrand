# The Olympus — the fish prompt and colours, in the house's greys.
#
#   ▲ host ~/where/you/are · branch ✕ 1
#   ❯

function __olympus_prompt
    set -l last $argv[1]
    set -l mark '❯'
    fish_is_root_user; and set mark '#'
    echo
    set_color 7a7a7a; echo -n '▲ '
    set_color fafafa; echo -n (prompt_hostname)' '
    set_color c9c9c9; echo -n (prompt_pwd)
    set -l branch (git symbolic-ref --short HEAD 2>/dev/null; or git rev-parse --short HEAD 2>/dev/null)
    if test -n "$branch"
        set_color 7a7a7a; echo -n " · $branch"
    end
    if test $last -ne 0
        set_color fafafa; echo -n " ✕ $last"
    end
    echo
    set_color fafafa; echo -n "$mark "
    set_color normal
end

function fish_prompt
    __olympus_prompt $status
end

# CachyOS and other setups set their own prompt after this file is read: take it back before the first prompt is drawn.
function __olympus_take_prompt --on-event fish_prompt
    functions -e __olympus_take_prompt
    function fish_prompt
        __olympus_prompt $status
    end
end

# Syntax highlighting: commands bright, arguments quieter, mistakes underlined rather than red.
set -g fish_color_command fafafa
set -g fish_color_param c9c9c9
set -g fish_color_keyword fafafa --bold
set -g fish_color_quote 9a9a9a
set -g fish_color_redirection 9a9a9a
set -g fish_color_end 9a9a9a
set -g fish_color_comment 6a6a6a
set -g fish_color_operator c9c9c9
set -g fish_color_escape b4b4b4
set -g fish_color_autosuggestion 5e5e5e
set -g fish_color_error fafafa --underline
set -g fish_color_valid_path --underline
set -g fish_color_search_match --background=3a3a3a
set -g fish_color_selection --background=3a3a3a
set -g fish_pager_color_prefix fafafa --bold
set -g fish_pager_color_completion c9c9c9
set -g fish_pager_color_description 7a7a7a
