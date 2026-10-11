# Writing a post

1. Copy `template/index.html` to `blog/<post-slug>/index.html` (a sibling of `template`). The relative stylesheet and navigation links will continue to work.
2. Replace the template copy, title, description, author metadata, and lead figure. Add the actual publication date and relevant paper/code links.
3. Remove the template notice and `noindex` meta tag when the article is ready to publish.
4. Keep section IDs and the contents links in sync. Use `<details>` for supplementary material, and descriptive alt text/captions for images. Use a poster and controls for video; avoid autoplay with sound.
5. Add a list item inside `.post-list` in `blog/index.html`, linking to `<post-slug>/index.html` and showing a publication date with `<time datetime="YYYY-MM-DD">(Mon YYYY)</time>`. Keep posts newest first and remove “No posts yet.” when publishing the first post. The template is kept at `blog/template/index.html` for authoring only, with no link on Home or Blog. Its `noindex` directive is retained; this is not access control.

The site uses static HTML and CSS, with no build step. Preview through a local static server or open `index.html` directly. Publishing uses the repository's existing GitHub Pages workflow.
