# Kattskrälle Useful Commands
- `ls` / `tree` to inspect the flat extension layout (JS, CSS, HTML, icons, images) before editing; the OS is Linux.
- `git status` + `git diff` after changes to verify what’s staged and ready for commit.
- `chrome://extensions` (or `google-chrome --load-extension=/srv/app/Kattskralle`) to load/unload the unpacked extension during local testing; refreshing the page in Chrome is the primary way to run the code.
- `git log --oneline` to follow earlier commit styles (short, descriptive statements such as “Update README…” or “Bump version…”).
- After any task, ensure `git status` is clean and that the `manifest.json` version is bumped if shipping a new release.
