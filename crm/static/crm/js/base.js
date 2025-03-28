const menuData = [
  {
    id: "projects",
    title: "案件管理",
    icon: "ki-outline ki-burger-menu fs-2",
    subItems: [{ title: "所有案件", url: "{% url 'projects' %}" }],
  },
  {
    id: "owners",
    title: "業主",
    icon: "ki-outline ki-address-book fs-2x",
    subItems: [{ title: "業主列表", url: "{% url 'owners' %}" }],
  },
  {
    id: "users",
    title: "公司人員",
    icon: "ki-outline ki-user-square fs-2",
    subItems: [
      { title: "帳號管理", url: "{% url 'users_index' %}" },
      { title: "其他聯絡人員 ", url: "{% url 'index' %}" },
    ],
  },
  {
    id: "accounting",
    title: "帳務",
    icon: "ki-outline ki-gear fs-2",
    subItems: [
      { title: "請款管理", url: "{% url 'create_payment' %}" },
      { title: "請款列表", url: "{% url 'payments' %}" },
      { title: "發票", url: "{% url 'invoices' %}" },
      { title: "收據", url: "{% url 'index' %}" },
    ],
  },
  {
    id: "settings",
    title: "設定",
    icon: "ki-outline ki-gear fs-2",
    subItems: [
      { title: "案件類別", url: "{% url 'category' %}" },
      { title: "匯出檔案", url: "{% url 'index' %}" },
    ],
  },
];

// 創建 Vue 應用
const sideBar = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      menuItems: menuData,
      activeMenus: {},
      currentPath: window.location.pathname,
    };
  },
  methods: {
    isActive(item) {
      if (!item.subItems) {
        return this.currentPath === item.url;
      }
      return (
        item.subItems.some((subItem) => this.currentPath === subItem.url) ||
        this.currentPath === item.url
      );
    },
    toggleSubmenu(item) {
      if (item.subItems) {
        this.activeMenus[item.id] = !this.activeMenus[item.id];
      }
    },
  },
  mounted() {
    // 初始化時根據當前路徑展開相應的子選單
    this.menuItems.forEach((item) => {
      if (item.subItems && this.isActive(item)) {
        this.activeMenus[item.id] = true;
      }
    });
  },
}).mount("#app_sidebar_menu");

const breadcrumbApp = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      menuItems: menuData, // 將從 sidebar_menu 取得
      currentPath: window.location.pathname,
      currentMenu: null,
      currentSubmenu: null,
    };
  },
  methods: {
    updateBreadcrumb() {
      // 尋找當前路徑對應的選單項目
      for (const menu of this.menuItems) {
        if (menu.subItems) {
          for (const submenu of menu.subItems) {
            if (submenu.url === this.currentPath) {
              this.currentMenu = menu;
              this.currentSubmenu = submenu;
              return;
            }
          }
        }
        // 檢查主選單項目是否匹配
        if (menu.url === this.currentPath) {
          this.currentMenu = menu;
          this.currentSubmenu = null;
          return;
        }
      }
    },
  },
  mounted() {
    this.updateBreadcrumb();
  },
}).mount("#app_breadcrumb");
