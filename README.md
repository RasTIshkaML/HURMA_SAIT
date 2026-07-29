# HURMA Website

Static browser client for the HURMA API. It does not require Node.js, npm, or a build step.

## Configure

Edit `config.js` and set the public HTTPS API URL:

```js
window.HURMA_CONFIG = {
  apiBaseUrl: "https://api.example.com"
};
```

The API server and website may use different domains because the current HURMA server enables CORS. Production traffic must pass through an HTTPS reverse proxy.

## Deploy

Upload the contents of `website/` to the document root of any static web host. The host must serve `index.html`, `styles.css`, `config.js`, and `app.js` as regular static files.

For local testing, serve the directory over HTTP instead of opening `index.html` directly. One option on a machine with PHP is:

```sh
php -S 127.0.0.1:4173 -t website
```

The site includes:

- responsive desktop and mobile layouts;
- public Soft, Visuals, and Resource Packs catalogs;
- search by title, description, or author;
- license-based registration and login;
- profile, avatar upload, and download history;
- notification polling and unread indicator;
- ratings, tracked downloads, and Resource Pack screenshot gallery;
- Creator/Owner content publishing with multiple screenshots;
- Owner license generation, notifications, roles, and user moderation;
- dark and light themes.
