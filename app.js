window.HURMA_CONFIG = { apiBaseUrl: "https://hurmaserver-production.up.railway.app/" };
(() => {
  "use strict";

  const config = window.HURMA_CONFIG || {};
  const apiBase = String(config.apiBaseUrl || "http://127.0.0.1:8080").replace(/\/$/, "");
  const state = {
    type: "client",
    content: [],
    token: localStorage.getItem("hurma.token") || "",
    user: JSON.parse(localStorage.getItem("hurma.user") || "null"),
    newestNotificationId: 0
  };

  const LOGO_URL = "https://s6.iimage.su/s/29/grQsSPkxzPFeIwVTsAj7EZwJ6cNgHSohdFXCiN62k.png";
  const THEME_PRESETS = [
    { name: "Зелёный", accent: "#62df79", ink: "#071009" },
    { name: "Голубой", accent: "#5b9aff", ink: "#060f1a" },
    { name: "Фиолетовый", accent: "#a855f7", ink: "#0e071a" },
    { name: "Красный", accent: "#ff4c5d", ink: "#1a070a" },
    { name: "Оранжевый", accent: "#ff8c42", ink: "#1a0f07" },
    { name: "Розовый", accent: "#ff6b9d", ink: "#1a0711" }
  ];

  function applyTheme(accent, ink) {
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-ink", ink);
    localStorage.setItem("hurma.accent", accent);
    localStorage.setItem("hurma.accent-ink", ink);
  }

  function applyThemeFromStorage() {
    const savedAccent = localStorage.getItem("hurma.accent");
    const savedInk = localStorage.getItem("hurma.accent-ink");
    if (savedAccent) applyTheme(savedAccent, savedInk || "#071009");
  }

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const modalRoot = $("#modalRoot");
  const catalogGrid = $("#catalogGrid");
  const catalogStatus = $("#catalogStatus");

  function escapeHtml(value = "") {
    const node = document.createElement("div");
    node.textContent = String(value);
    return node.innerHTML;
  }

  function base64Image(value) {
    if (!value) return "";
    return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
  }

  async function api(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("json") ? await response.json() : null;
    if (!response.ok) {
      if (response.status === 401 && path !== "/api/login") clearSession();
      throw new Error(body?.error || `Ошибка сервера: ${response.status}`);
    }
    return body;
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("visible"), 3200);
  }

  function updateAccount() {
    $("#accountButton").textContent = state.user?.displayName || state.user?.username || "Войти";
  }

  function saveSession(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem("hurma.token", token);
    localStorage.setItem("hurma.user", JSON.stringify(user));
    updateAccount();
    checkNotifications();
  }

  function clearSession() {
    state.token = "";
    state.user = null;
    localStorage.removeItem("hurma.token");
    localStorage.removeItem("hurma.user");
    $("#notificationBadge").hidden = true;
    updateAccount();
  }

  function openModal(content, wide = false) {
    modalRoot.innerHTML = `<section class="modal${wide ? " wide" : ""}" role="dialog" aria-modal="true">${content}</section>`;
    modalRoot.hidden = false;
    document.body.style.overflow = "hidden";
    $(".close-button", modalRoot)?.focus();
  }

  function closeModal() {
    modalRoot.hidden = true;
    modalRoot.innerHTML = "";
    document.body.style.overflow = "";
  }

  function modalHead(title) {
    return `<div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="close-button" data-close aria-label="Закрыть">×</button></div>`;
  }

  async function loadCatalog() {
    catalogStatus.hidden = false;
    catalogGrid.innerHTML = "";
    if (!state.token) {
      catalogStatus.textContent = "";
      catalogGrid.innerHTML = `<div class="auth-required"><span class="auth-required-icon">🔒</span><h3>Требуется вход</h3><p>Войдите в аккаунт, чтобы просматривать и скачивать контент.</p><button class="primary-button" data-action="auth">Войти</button></div>`;
      return;
    }
    catalogStatus.textContent = "Загружаем каталог...";
    try {
      const data = await api(`/api/content?type=${encodeURIComponent(state.type)}`);
      state.content = data?.items || [];
      renderCatalog();
    } catch (error) {
      catalogStatus.textContent = `Каталог недоступен. ${error.message}`;
    }
  }

  function renderCatalog() {
    const query = $("#searchInput").value.trim().toLocaleLowerCase("ru");
    const items = state.content.filter(item => [item.name, item.description, item.metadata?.author].some(value => String(value || "").toLocaleLowerCase("ru").includes(query)));
    catalogStatus.hidden = items.length > 0;
    if (!items.length) catalogStatus.textContent = query ? "По вашему запросу ничего не найдено." : "В этой категории пока пусто.";
    catalogGrid.innerHTML = items.map((item, index) => {
      const image = base64Image(item.metadata?.imageBase64 || item.metadata?.previewBase64);
      const type = item.type === "resourcepack" ? "Resource Pack" : item.type === "visual" ? "Visual" : "Soft";
      return `<article class="content-card" style="animation-delay:${Math.min(index * 45, 300)}ms">
        <div class="card-image">
          ${image ? `<img src="${image}" alt="">` : `<span class="image-placeholder">${escapeHtml(item.name?.slice(0, 1).toUpperCase() || "H")}</span>`}
          <span class="card-type">${type}</span>
        </div>
        <div class="card-body">
          <div class="card-meta"><span>${escapeHtml(item.metadata?.author || "HURMA")}</span><span>v${escapeHtml(item.version || "1.0")}</span></div>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="card-description">${escapeHtml(item.description || "Описание скоро появится.")}</p>
          <div class="card-footer"><span class="rating">★ ${Number(item.ratingAverage || 0).toFixed(1)} <small>(${item.ratingCount || 0})</small></span><button class="card-button" data-content-id="${item.id}">Подробнее</button></div>
        </div>
      </article>`;
    }).join("");
  }

  function showContent(item) {
    const image = base64Image(item.metadata?.imageBase64 || item.metadata?.previewBase64);
    const screenshots = Array.isArray(item.metadata?.screenshotsBase64) ? item.metadata.screenshotsBase64 : [];
    const canDelete = state.token && (Number(state.user?.id) === Number(item.createdBy) || state.user?.role === "Owner");
    openModal(`${modalHead(item.name)}
      <div class="detail-layout">
        <div>
          <div class="detail-cover">${image ? `<img src="${image}" alt="${escapeHtml(item.name)}">` : `<span class="image-placeholder">H</span>`}</div>
          ${screenshots.length ? `<div class="gallery">${screenshots.map((shot, index) => `<img src="${base64Image(shot)}" alt="Скриншот ${index + 1}" data-gallery>`).join("")}</div>` : ""}
        </div>
        <div class="detail-copy">
          <p class="eyebrow"><span></span>${escapeHtml(item.metadata?.author || "HURMA")}</p>
          <p>${escapeHtml(item.description || "Описание скоро появится.")}</p>
          <div class="detail-stats"><span>Версия ${escapeHtml(item.version)}</span><span>★ ${Number(item.ratingAverage || 0).toFixed(1)}</span><span>↓ ${item.downloadCount || 0}</span></div>
          <p>Оцените материал:</p>
          <div class="stars">${[1,2,3,4,5].map(value => `<button class="star" data-rate="${value}" data-id="${item.id}" aria-label="${value} звёзд">★</button>`).join("")}</div>
          <button class="submit-button" data-download="${item.id}">Скачать ${escapeHtml(item.artifactName || "файл")}</button>
          ${canDelete ? `<button class="danger-button full-button" data-delete-content="${item.id}" data-delete-type="${escapeHtml(item.type)}" data-delete-name="${escapeHtml(item.name)}" style="margin-top:12px">Удалить материал</button>` : ""}
        </div>
      </div>`, true);
  }

  async function downloadItem(item) {
    if (!state.token) return showAuth("login", "Войдите, чтобы скачать материал.");
    try {
      await api("/api/download-history", { method: "POST", body: JSON.stringify({ contentId: item.id, contentName: item.name, contentType: item.type }) });
      const link = document.createElement("a");
      link.href = new URL(item.downloadUrl, `${apiBase}/`).href;
      link.download = item.artifactName || "";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast("Загрузка началась");
      loadCatalog();
    } catch (error) { toast(error.message); }
  }

  async function rateItem(id, rating) {
    if (!state.token) return showAuth("login", "Войдите, чтобы поставить оценку.");
    try {
      await api("/api/content/rate", { method: "POST", body: JSON.stringify({ contentId: id, rating }) });
      toast("Оценка сохранена");
      closeModal();
      loadCatalog();
    } catch (error) { toast(error.message); }
  }

  function showAuth(mode = "login", notice = "") {
    const login = mode === "login";
    openModal(`${modalHead(login ? "С возвращением" : "Создать аккаунт")}
      <div class="form-tabs"><button class="form-tab ${login ? "active" : ""}" data-auth-mode="login">Вход</button><button class="form-tab ${!login ? "active" : ""}" data-auth-mode="register">Регистрация</button></div>
      ${notice ? `<p class="catalog-status">${escapeHtml(notice)}</p>` : ""}
      <form id="authForm" class="form-grid" data-mode="${mode}">
        ${login ? `<label class="field">Email или логин<input name="email" required autocomplete="username"></label>` : `
          <div class="form-grid two"><label class="field">Логин<input name="username" required minlength="3" maxlength="24" autocomplete="username"></label><label class="field">Имя<input name="displayName" autocomplete="name"></label></div>
          <label class="field">Email<input name="email" type="email" required autocomplete="email"></label>
          <label class="field">Лицензионный ключ<input name="licenseKey" required autocomplete="off" placeholder="HURMA-XXXXX-XXXXX-XXXXX"></label>`}
        <label class="field">Пароль<div class="password-wrap"><input name="password" type="password" required minlength="8" autocomplete="${login ? "current-password" : "new-password"}"><button class="pass-toggle" type="button" data-toggle-pass aria-label="Показать пароль">👁</button></div></label>
        ${!login ? `<label class="field">Подтвердите пароль<div class="password-wrap"><input name="confirmPassword" type="password" required minlength="8" autocomplete="new-password"><button class="pass-toggle" type="button" data-toggle-pass aria-label="Показать пароль">👁</button></div></label>` : ""}
        <button class="submit-button" type="submit">${login ? "Войти" : "Зарегистрироваться"}</button>
        ${login ? `<button class="ghost-button" type="button" data-action="support" style="width:100%;margin-top:8px;gap:8px;font-size:13px">Восстановление аккаунта</button>` : ""}
        <p style="color:var(--muted);font-size:12px;text-align:center;margin:0">По всем вопросам писать в <a href="https://discord.gg/JYDedjMP8G" target="_blank" style="color:var(--accent)">Discord</a></p>
      </form>`);
  }

  async function submitAuth(form) {
    const data = Object.fromEntries(new FormData(form));
    const mode = form.dataset.mode;
    const button = $("button[type=submit]", form);
    button.disabled = true;
    try {
      if (mode === "register") {
        if (data.password !== data.confirmPassword) return toast("Пароли не совпадают");
        await api("/api/register", { method: "POST", body: JSON.stringify({ ...data, hwid: "" }) });
        showAuth("login", "Аккаунт создан. Теперь войдите.");
      } else {
        const result = await api("/api/login", { method: "POST", body: JSON.stringify({ email: data.email, password: data.password, hwid: "" }) });
        saveSession(result.token, result.user);
        closeModal();
        toast(`Добро пожаловать, ${result.user.displayName || result.user.username}`);
      }
    } catch (error) { toast(error.message); button.disabled = false; }
  }

  async function showProfile() {
    if (!state.token) return showAuth();
    try {
      const [profile, history] = await Promise.all([api("/api/profile"), api("/api/download-history")]);
      const avatar = base64Image(profile.avatarBase64);
      const currentAccent = localStorage.getItem("hurma.accent") || "#62df79";
      const cd = profile.usernameChangeRemaining;
      openModal(`${modalHead("Профиль")}
        <div class="profile-grid"><div class="avatar">${avatar ? `<img src="${avatar}" alt="Аватар">` : escapeHtml(profile.username?.slice(0,1).toUpperCase() || "H")}</div><div><h3>${escapeHtml(profile.displayName || profile.username)}</h3><p class="catalog-status">${escapeHtml(profile.role)}</p><label class="card-button">Сменить аватар<input id="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div></div>
        <div class="data-list" style="margin-top:24px">
          <div class="data-row" data-copy="${escapeHtml(profile.username)}"><span>Логин</span><strong>${escapeHtml(profile.username)}</strong></div>
          <div class="data-row" data-copy="${escapeHtml(profile.email)}"><span>Email</span><strong>${escapeHtml(profile.email)}</strong></div>
        </div>
        <form id="profileEditForm" class="form-grid" style="margin-top:20px">
          <div class="form-grid two"><label class="field">Новое имя<input name="displayName" value="${escapeHtml(profile.displayName || "")}" placeholder="${escapeHtml(profile.displayName || "")}"></label><label class="field">Новый логин<input name="username" value="${escapeHtml(profile.username)}" minlength="3" maxlength="24">${cd > 0 ? `<span style="color:var(--muted);font-size:11px;text-transform:none;letter-spacing:0">Смена через ${cd} дн.</span>` : ""}</label></div>
          <div style="border-top:1px solid var(--line);padding-top:14px;margin-top:4px"><label class="field">Старый пароль<div class="password-wrap"><input name="oldPassword" type="password" autocomplete="current-password"><button class="pass-toggle" type="button" data-toggle-pass aria-label="Показать пароль">👁</button></div></label><label class="field" style="margin-top:10px">Новый пароль<div class="password-wrap"><input name="newPassword" type="password" minlength="8" autocomplete="new-password"><button class="pass-toggle" type="button" data-toggle-pass aria-label="Показать пароль">👁</button></div></label></div>
          <button class="submit-button" type="submit">Сохранить</button>
        </form>
        <h3 style="margin-top:28px">История загрузок</h3><div class="data-list">${(history.items || []).slice(0, 12).map(entry => `<div class="data-row" data-copy="${escapeHtml(entry.contentName)}"><span>${escapeHtml(entry.contentType)}</span><strong>${escapeHtml(entry.contentName)}</strong></div>`).join("") || `<p class="catalog-status">Загрузок пока нет.</p>`}</div>
        <div class="theme-section"><h3>Цвет темы</h3><div class="theme-presets">${THEME_PRESETS.map(p => `<button class="theme-preset" style="background:${p.accent}" data-theme-accent="${p.accent}" data-theme-ink="${p.ink}" title="${p.name}"></button>`).join("")}</div><div class="theme-custom-row"><label>Свой</label><input id="customColorPicker" type="color" value="${escapeHtml(currentAccent)}"></div></div>
        ${["Creator", "Admin", "Owner"].includes(profile.role) ? `<button class="submit-button full-button" data-admin>Открыть панель ${profile.role === "Owner" ? "Owner" : "Creator"}</button>` : ""}
        <button class="logout-button" data-logout>Выйти из аккаунта</button>`);
      setTimeout(() => {
        const cp = $("#customColorPicker");
        if (cp) cp.addEventListener("input", () => applyTheme(cp.value, "#071009"));
      }, 50);
    } catch (error) { toast(error.message); }
  }

  async function uploadAvatar(file) {
    if (!file || file.size > 5 * 1024 * 1024) return toast("Изображение должно быть меньше 5 MiB");
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    try {
      await api("/api/profile/avatar", { method: "PUT", body: JSON.stringify({ avatarBase64: base64 }) });
      toast("Аватар обновлён");
      showProfile();
    } catch (error) { toast(error.message); }
  }

  async function checkNotifications() {
    if (!state.token) return;
    try {
      const data = await api("/api/notifications");
      const newest = Math.max(0, ...(data.items || []).map(item => Number(item.id)));
      state.newestNotificationId = newest;
      const seen = Number(localStorage.getItem("hurma.notifications.seen") || 0);
      $("#notificationBadge").hidden = newest <= seen;
    } catch (_) { /* Background polling stays silent. */ }
  }

  async function showNotifications() {
    if (!state.token) return showAuth();
    try {
      const data = await api("/api/notifications");
      const items = data.items || [];
      state.newestNotificationId = Math.max(0, ...items.map(item => Number(item.id)));
      localStorage.setItem("hurma.notifications.seen", String(state.newestNotificationId));
      $("#notificationBadge").hidden = true;
      openModal(`${modalHead("Уведомления")}<div class="notification-list">${items.map(item => `<article class="notification-item"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message)}</p><time>${escapeHtml(item.createdAt)}</time></article>`).join("") || `<p class="catalog-status">Уведомлений пока нет.</p>`}</div>`);
    } catch (error) { toast(error.message); }
  }

  function showSupport() {
    openModal(`${modalHead("Поддержка")}
      <p style="color:var(--muted);line-height:1.6">По всем вопросам, а также восстановлению аккаунта писать в этот Discord:</p>
      <div style="display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;margin-top:8px;cursor:pointer" data-copy="wertyyyyx" title="Нажмите чтобы скопировать">
        <span style="font-size:24px">💬</span>
        <strong style="font-size:18px">wertyyyyx</strong>
        <span style="margin-left:auto;color:var(--muted);font-size:12px">копировать</span>
      </div>`);
    setTimeout(() => {
      const el = $("[data-copy]", modalRoot);
      if (el) el.addEventListener("click", () => { navigator.clipboard.writeText("wertyyyyx"); toast("Скопировано: wertyyyyx"); });
    }, 50);
  }

  function showAdmin(section = "content") {
    if (!["Creator", "Admin", "Owner"].includes(state.user?.role)) return toast("Недостаточно прав");
    const owner = state.user.role === "Owner";
    openModal(`${modalHead(owner ? "Owner Console" : "Creator Console")}
      <div class="admin-tabs">
        <button class="form-tab ${section === "content" ? "active" : ""}" data-admin-section="content">Контент</button>
        ${owner ? `<button class="form-tab ${section === "licenses" ? "active" : ""}" data-admin-section="licenses">Лицензии</button><button class="form-tab ${section === "broadcast" ? "active" : ""}" data-admin-section="broadcast">Рассылка</button><button class="form-tab ${section === "users" ? "active" : ""}" data-admin-section="users">Пользователи</button>` : ""}
      </div>
      <div id="adminBody">${adminSection(section)}</div>`, true);
    if (section === "licenses") { loadLicenses(); setTimeout(() => $("#licenseSearch")?.addEventListener("input", () => loadLicenses($("#licenseSearch").value)), 50); }
    if (section === "broadcast") loadNotificationsList();
    if (section === "users") loadAdminUsers();
  }

  function adminSection(section) {
    if (section === "licenses") return `<div class="admin-section"><form id="licenseForm" class="inline-form"><label class="field">Количество<input name="count" type="number" min="1" max="100" value="1" required></label><button class="submit-button" type="submit">Создать ключи</button></form><div class="license-search"><input id="licenseSearch" type="search" placeholder="Поиск по ключу, пользователю или статусу..." autocomplete="off"></div><div id="licenseList" class="data-list"><p class="catalog-status">Загружаем лицензии...</p></div></div>`;
    if (section === "broadcast") return `<form id="broadcastForm" class="form-grid"><label class="field">Заголовок<input name="title" maxlength="120" required></label><label class="field">Сообщение<textarea name="message" rows="6" required></textarea></label><button class="submit-button" type="submit">Отправить всем</button></form><div class="admin-broadcast-list" id="notificationAdminList"><p class="catalog-status">Загружаем уведомления...</p></div>`;
    if (section === "users") return `<form id="userForm" class="form-grid"><label class="field">Логин пользователя<input id="userSearchInput" name="username" required autocomplete="off"></label><div class="admin-actions"><button class="card-button" type="submit" name="action" value="block">Заблокировать</button><button class="card-button" type="submit" name="action" value="unblock">Разблокировать</button><button class="card-button" type="submit" name="action" value="unbind">Отвязать HWID</button><button class="danger-button" type="submit" name="action" value="delete">Удалить</button></div></form><form id="roleForm" class="inline-form"><label class="field">Логин<input name="username" required autocomplete="off"></label><label class="field">Роль<select name="role"><option>User</option><option>Creator</option><option>Owner</option></select></label><button class="submit-button" type="submit">Назначить</button></form><div style="margin-top:20px"><h3>Все пользователи <span id="userCount" style="color:var(--muted);font-size:13px"></span></h3><div id="userListContainer" class="data-list" style="max-height:300px;overflow-y:auto"><p class="catalog-status">Загружаем...</p></div></div>`;
    return `<div class="admin-columns"><form id="contentForm" class="form-grid"><h3>Новая публикация</h3><div class="form-grid two"><label class="field">Тип<select name="type"><option value="client">Soft</option><option value="visual">Visual</option><option value="resourcepack">Resource Pack</option></select></label><label class="field">Версия<input name="version" required placeholder="1.0.0"></label></div><label class="field">Название<input name="name" required></label><label class="field">Описание<textarea name="description" rows="4"></textarea></label><label class="field">Артефакт до 25 MiB<input name="artifact" type="file" required></label><label class="field">Обложка до 5 MiB<input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="field">Скриншоты Resource Pack, до 6<input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><button class="submit-button" type="submit">Опубликовать</button></form><form id="deleteContentForm" class="form-grid admin-danger-zone"><h3>Удалить материал</h3><label class="field">Тип<select name="type"><option value="client">Soft</option><option value="visual">Visual</option><option value="resourcepack">Resource Pack</option></select></label><label class="field">Точное название<input name="name" required></label><button class="danger-button" type="submit">Удалить</button></form></div>`;
  }

  function fileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function createContent(form) {
    const data = new FormData(form);
    const artifact = data.get("artifact");
    const image = data.get("image");
    const screenshots = [...form.elements.screenshots.files].slice(0, 6);
    if (!artifact?.size || artifact.size > 25 * 1024 * 1024) return toast("Артефакт должен быть меньше 25 MiB");
    if (image?.size > 5 * 1024 * 1024) return toast("Обложка должна быть меньше 5 MiB");
    if (screenshots.some(file => file.size > 4 * 1024 * 1024) || screenshots.reduce((sum, file) => sum + file.size, 0) > 12 * 1024 * 1024) return toast("Превышен лимит скриншотов");
    const submit = $("button[type=submit]", form);
    submit.disabled = true;
    submit.textContent = "Загрузка...";
    try {
      const metadata = {};
      if (image?.size) metadata.imageBase64 = await fileBase64(image);
      if (data.get("type") === "resourcepack" && screenshots.length) metadata.screenshotsBase64 = await Promise.all(screenshots.map(fileBase64));
      await api("/api/content", { method: "POST", body: JSON.stringify({ type: data.get("type"), name: data.get("name"), version: data.get("version"), description: data.get("description"), artifactName: artifact.name, artifactBase64: await fileBase64(artifact), metadata, published: true }) });
      toast("Материал опубликован");
      closeModal();
      loadCatalog();
    } catch (error) { toast(error.message); submit.disabled = false; submit.textContent = "Опубликовать"; }
  }

  async function loadLicenses(query = "") {
    try {
      const data = await api("/api/admin/licenses");
      const list = $("#licenseList");
      if (!list) return;
      const q = query.toLocaleLowerCase("ru").trim();
      const filtered = q ? (data.items || []).filter(item =>
        item.key.toLocaleLowerCase("ru").includes(q) ||
        (item.username || "").toLocaleLowerCase("ru").includes(q) ||
        item.status.includes(q)
      ) : (data.items || []);
      list.innerHTML = (!filtered.length ? `<p class="catalog-status">${q ? "Ничего не найдено." : "Ключей нет."}</p>`
        : filtered.map(item => `<div class="license-row ${item.status === "blocked" ? "blocked" : ""}"><div><strong data-copy="${escapeHtml(item.key)}" style="cursor:pointer" title="Копировать">${escapeHtml(item.key)}</strong><small>${escapeHtml(item.status)}${item.username ? ` · ${escapeHtml(item.username)}` : ""}</small></div><div class="row-actions"><button class="card-button" data-license-block="${escapeHtml(item.key)}" data-blocked="${item.status === "blocked"}">${item.status === "blocked" ? "Разблокировать" : "Блок"}</button>${item.status === "unused" ? `<button class="danger-button compact" data-license-delete="${escapeHtml(item.key)}">Удалить</button>` : ""}</div></div>`).join(""));
    } catch (error) { toast(error.message); }
  }

  async function loadNotificationsList() {
    try {
      const data = await api("/api/notifications");
      const list = $("#notificationAdminList");
      if (!list) return;
      list.innerHTML = (!data.items || !data.items.length ? `<p class="catalog-status">Уведомлений пока нет.</p>`
        : data.items.map(item => `<article class="admin-broadcast-item"><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.message)}</p><time>${escapeHtml(item.createdAt)}</time></div><button class="danger-button compact" data-notif-delete="${item.id}">Удалить</button></article>`).join(""));
    } catch (error) { toast(error.message); }
  }

  async function loadAdminUsers() {
    try {
      const data = await api("/api/admin/users");
      const items = data?.items || [];
      const container = $("#userListContainer");
      const count = $("#userCount");
      if (count) count.textContent = `(${items.length})`;
      if (container) {
        if (!items.length) { container.innerHTML = `<p class="catalog-status">Нет пользователей</p>`; return; }
        container.innerHTML = items.map(u =>
          `<div class="data-row" data-copy="${escapeHtml(u.username)}" style="cursor:pointer">
            <span>${escapeHtml(u.role === "Admin" ? "Creator" : u.role)}${u.blocked ? ' 🔒' : ''}</span>
            <strong>${escapeHtml(u.username)}</strong>
            <span style="color:var(--muted);font-size:12px">${escapeHtml(u.email)}</span>
          </div>`
        ).join("");
      }
    } catch (error) { toast(error.message); }
  }

  async function adminRequest(path, body, message) {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      toast(message);
      return true;
    } catch (error) { toast(error.message); return false; }
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("button, a, img");
    if (!target) return;
    if (target.matches("[data-close]")) closeModal();
    if (target.dataset.action === "auth") state.user ? showProfile() : showAuth();
    if (target.dataset.action === "profile") showProfile();
    if (target.dataset.action === "notifications") showNotifications();
    if (target.dataset.action === "support") showSupport();
    if (target.dataset.authMode) showAuth(target.dataset.authMode);
    if (target.hasAttribute("data-admin")) showAdmin();
    if (target.dataset.adminSection) showAdmin(target.dataset.adminSection);
    if (target.dataset.contentId) {
      if (!state.token) return showAuth("login", "Войдите, чтобы просмотреть материал.");
      showContent(state.content.find(item => String(item.id) === target.dataset.contentId));
    }
    if (target.dataset.download) downloadItem(state.content.find(item => String(item.id) === target.dataset.download));
    if (target.dataset.rate) rateItem(Number(target.dataset.id), Number(target.dataset.rate));
    if (target.hasAttribute("data-logout")) { clearSession(); closeModal(); toast("Вы вышли из аккаунта"); }
    if (target.dataset.licenseBlock) adminRequest("/api/admin/licenses/block", { key: target.dataset.licenseBlock, blocked: target.dataset.blocked !== "true" }, "Лицензия обновлена").then(ok => ok && loadLicenses($("#licenseSearch")?.value || ""));
    if (target.dataset.licenseDelete) adminRequest("/api/admin/licenses/delete", { key: target.dataset.licenseDelete }, "Лицензия удалена").then(ok => ok && loadLicenses($("#licenseSearch")?.value || ""));
    if (target.dataset.notifDelete) adminRequest("/api/admin/notifications/delete", { id: Number(target.dataset.notifDelete) }, "Уведомление удалено").then(ok => ok && loadNotificationsList());
    if (target.dataset.scroll) $(`#${target.dataset.scroll}`)?.scrollIntoView({ behavior: "smooth" });
    if (target.dataset.themeAccent) applyTheme(target.dataset.themeAccent, target.dataset.themeInk);
    if (target.dataset.deleteContent) {
      const type = target.dataset.deleteType;
      const name = target.dataset.deleteName;
      openModal(`${modalHead("Подтверждение удаления")}
        <p style="color:var(--muted);line-height:1.6">Вы уверены, что хотите удалить <strong>${escapeHtml(name)}</strong>?<br>Это действие нельзя отменить.</p>
        <div style="display:flex;gap:12px;margin-top:20px">
          <button class="submit-button" style="flex:1;background:transparent;color:var(--text);border-color:var(--line)" data-close>Отмена</button>
          <button class="danger-button" style="flex:1" id="confirmDeleteBtn">Удалить</button>
        </div>`);
      setTimeout(() => {
        const btn = $("#confirmDeleteBtn");
        if (btn) btn.addEventListener("click", async () => {
          const ok = await adminRequest("/api/admin/content/delete-by-name", { type, name }, "Материал удалён");
          if (ok) { closeModal(); loadCatalog(); }
        });
      }, 50);
    }
    if (target.dataset.themeAccent) applyTheme(target.dataset.themeAccent, target.dataset.themeInk);
    if (target.dataset.copy) {
      const text = target.dataset.copy;
      navigator.clipboard.writeText(text).then(() => toast("Скопировано: " + text)).catch(() => toast("Не удалось скопировать"));
    }
    if (target.dataset.togglePass !== undefined) {
      const wrap = target.closest(".password-wrap");
      const input = wrap?.querySelector("input");
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
        target.textContent = input.type === "password" ? "👁" : "👁‍🗨";
      }
    }
    if (target.hasAttribute("data-gallery")) openModal(`${modalHead("Скриншот")}<img src="${target.src}" alt="Скриншот" style="display:block;max-width:100%;max-height:75vh;margin:auto;border-radius:14px">`, true);
  });

  document.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    if (form.id === "authForm") submitAuth(form);
    if (form.id === "contentForm") createContent(form);
    if (form.id === "deleteContentForm") adminRequest("/api/admin/content/delete-by-name", Object.fromEntries(new FormData(form)), "Материал удалён").then(ok => { if (ok) { closeModal(); loadCatalog(); } });
    if (form.id === "broadcastForm") adminRequest("/api/admin/notifications", Object.fromEntries(new FormData(form)), "Уведомление отправлено").then(ok => ok && form.reset());
    if (form.id === "licenseForm") adminRequest("/api/admin/licenses/generate", { count: Number(new FormData(form).get("count")) }, "Лицензии созданы").then(ok => ok && loadLicenses());
    if (form.id === "userForm") { const submitter = event.submitter; adminRequest("/api/admin/users/action", { username: new FormData(form).get("username"), action: submitter?.value }, "Пользователь обновлён"); }
    if (form.id === "roleForm") { const data = Object.fromEntries(new FormData(form)); api("/api/admin/users/role", { method: "PUT", body: JSON.stringify(data) }).then(() => toast("Роль назначена")).catch(error => toast(error.message)); }
    if (form.id === "profileEditForm") {
      const data = Object.fromEntries(new FormData(form));
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      (async () => {
        try {
          if (data.displayName || data.username) {
            const update = { displayName: data.displayName, username: data.username };
            const profile = await api("/api/profile", { method: "PUT", body: JSON.stringify(update) });
            state.user.displayName = profile.displayName;
            state.user.username = profile.username;
            localStorage.setItem("hurma.user", JSON.stringify(state.user));
            updateAccount();
          }
          if (data.oldPassword && data.newPassword) {
            const result = await api("/api/profile/change-password", { method: "POST", body: JSON.stringify({ oldPassword: data.oldPassword, newPassword: data.newPassword }) });
            saveSession(result.token, state.user);
          }
          toast("Профиль обновлён");
          showProfile();
        } catch (error) { toast(error.message); btn.disabled = false; }
      })();
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "avatarInput") uploadAvatar(event.target.files[0]);
  });

  $$(".type-tab").forEach(button => button.addEventListener("click", () => {
    $$(".type-tab").forEach(item => item.classList.toggle("active", item === button));
    state.type = button.dataset.type;
    loadCatalog();
  }));
  $("#searchInput").addEventListener("input", renderCatalog);
  $("#menuButton").addEventListener("click", () => $(".topnav").classList.toggle("open"));
  $("#themeButton").addEventListener("click", () => { document.body.classList.toggle("light"); localStorage.setItem("hurma.theme", document.body.classList.contains("light") ? "light" : "dark"); });
  modalRoot.addEventListener("click", event => { if (event.target === modalRoot) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modalRoot.hidden) closeModal(); });

  document.documentElement.style.setProperty("--logo-url", `url("${LOGO_URL}")`);
  applyThemeFromStorage();
  if (localStorage.getItem("hurma.theme") === "light") document.body.classList.add("light");
  updateAccount();
  loadCatalog();
  checkNotifications();
  setInterval(checkNotifications, 30000);
})();
