const projectList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      projects: [],
      ownerId: OWNER_ID, // 從模板傳入的業主ID
      categories: [], // 類別資料
      users: [], // 用戶資料
      projectManagers: [], // 專案經理列表
      designers: [], // 設計師列表
      isLoading: false,
      searchQuery: "",
      categoryFilter: "",
      yearFilter: "",
      activeMenu: null,
      currentPage: 1,
      totalPages: 1,
      pageSize: 10, // 每頁顯示的項目數，可調整
      menuPosition: {
        x: 0,
        y: 0,
      },
      showModal: false,
      isEditMode: false,
      editProjectId: null,
      availableYears: [],
      newProject: {
        owner: OWNER_ID, // 預設為目前業主
        category: "",
        year: new Date().getFullYear(),
        project_number: "",
        name: "",
        manager: "",
        drawing: "",
        drawing_other: "",
        contact_info: "",
        change_count: 0,
        change_description: "",
        notes: "",
        is_completed: false,
        expenditure: 0.0,
        is_invoiced: false,
        invoice_date: null,
        invoice_amount: null,
        payment_date: null,
        invoice_issue_date: null,
        invoice_notes: "",
        is_paid: false,
      },
    };
  },
  computed: {
    categoryMap() {
      return this.categories.reduce((acc, category) => {
        acc[category.id] = category;
        return acc;
      }, {});
    },
    userMap() {
      return this.users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
    },
  },
  methods: {
    deleteProject(projectId) {
      if (confirm("確定要刪除此專案嗎？此操作無法還原！")) {
        fetch(`/crm/api/projects/${projectId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              '[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("刪除失敗");
            }
            this.fetchOwnerProjects(this.currentPage); // 重新獲取當前頁數據
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
      }
    },
    editProject(project) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editProjectId = project.id;

      // 深度複製專案數據，避免直接修改列表數據
      this.newProject = JSON.parse(JSON.stringify(project));

      // 顯示模態框
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },
    viewQuotations(projectId) {
      // 導航到該專案的報價列表頁面
      window.location.href = `/crm/project/${projectId}/quotations/`;
      // 關閉下拉選單
      this.activeMenu = null;
    },
    viewInvoices(projectId) {
      // 導航到該專案的請款列表頁面
      window.location.href = `/crm/project/${projectId}/invoices/`;
      // 關閉下拉選單
      this.activeMenu = null;
    },
    fetchOwnerProjects(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/projects/?format=json&page=${page}&page_size=${this.pageSize}&owner=${this.ownerId}`;

      // 添加搜尋條件
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      // 添加過濾條件
      if (this.categoryFilter) {
        url += `&category=${this.categoryFilter}`;
      }

      if (this.yearFilter) {
        url += `&year=${this.yearFilter}`;
      }

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.projects = data.results;
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching projects:", error))
        .finally(() => {
          this.isLoading = false;
        });
    },
    fetchCategories() {
      fetch(`/crm/api/categories/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.categories = data.results;
        })
        .catch((error) => console.error("Error fetching categories:", error));
    },
    fetchUsers() {
      fetch(`/users/api?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.users = data.results;
          this.projectManagers = this.users.filter(
            (user) => user.profile.is_project_manager
          );
          this.designers = this.users.filter(
            (user) => user.profile.is_designer
          );
        })
        .catch((error) => console.error("Error fetching users:", error));
    },
    fetchYears() {
      // 獲取所有可用的年份
      fetch(`/crm/api/projects/years/`)
        .then((response) => response.json())
        .then((data) => {
          this.availableYears = data.years;
          if (!this.availableYears.includes(new Date().getFullYear())) {
            this.availableYears.unshift(new Date().getFullYear());
          }
        })
        .catch((error) => {
          console.error("Error fetching years:", error);
          this.availableYears = [new Date().getFullYear()];
        });
    },
    getCategoryName(categoryId) {
      const category = this.categoryMap[categoryId];
      return category ? `${category.code}: ${category.description}` : "未分類";
    },
    getManagerName(managerId) {
      const manager = this.userMap[managerId];
      return manager ? manager.profile.name || manager.username : "未指派";
    },
    getStatusBadgeClass(project) {
      return project.is_completed
        ? "badge-light-success"
        : "badge-light-warning";
    },
    toggleMenu(projectId) {
      if (this.activeMenu === projectId) {
        this.activeMenu = null;
      } else {
        // 計算位置
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120, // 向左偏移 120px
          y: rect.bottom + 10, // 向下偏移 10px
        };
        this.activeMenu = projectId;
      }
      event.stopPropagation();
    },
    showAddProjectModal() {
      this.showModal = true;
      this.isEditMode = false;
      this.editProjectId = null;

      // 重置表單數據
      this.newProject = {
        owner: this.ownerId, // 預設為目前業主
        category: "",
        year: new Date().getFullYear(),
        project_number: "",
        name: "",
        manager: "",
        drawing: "",
        drawing_other: "",
        contact_info: "",
        change_count: 0,
        change_description: "",
        notes: "",
        is_completed: false,
        expenditure: 0.0,
        is_invoiced: false,
        invoice_date: null,
        invoice_amount: null,
        payment_date: null,
        invoice_issue_date: null,
        invoice_notes: "",
        is_paid: false,
      };

      // 使用 Bootstrap 的 Modal API 顯示
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
    },
    getMenuStyle(projectId) {
      if (this.activeMenu !== projectId) {
        return { display: "none" };
      }
      return {
        "z-index": "107",
        position: "fixed",
        inset: "0px auto auto 0px",
        margin: "0px",
        transform: `translate(${this.menuPosition.x}px, ${this.menuPosition.y}px)`,
      };
    },
    handleClickOutside(event) {
      // 如果點擊的不是下拉選單或操作按鈕，則關閉選單
      if (this.activeMenu !== null) {
        const menu = document.querySelector(".menu.show");
        const button = document.querySelector(".btn-active-light-primary");

        if (
          menu &&
          !menu.contains(event.target) &&
          button &&
          !button.contains(event.target)
        ) {
          this.activeMenu = null;
        }
      }
    },
    hideAddProjectModal() {
      this.showModal = false;

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addProjectModal")
      );
      modal.hide();
    },
    submitProjectForm() {
      // 準備提交的數據
      const formData = { ...this.newProject };

      // 處理可能的 null 值
      if (!formData.drawing) {
        formData.drawing = null;
      }

      const url = this.isEditMode
        ? `/crm/api/projects/${this.editProjectId}/`
        : "/crm/api/projects/";
      const method = this.isEditMode ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(formData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(this.isEditMode ? "更新專案失敗" : "創建專案失敗");
          }
          return response.json();
        })
        .then(() => {
          this.hideAddProjectModal(); // 提交成功後關閉 Modal
          this.fetchOwnerProjects(this.currentPage); // 刷新專案列表
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(
            this.isEditMode
              ? "更新專案失敗，請稍後再試"
              : "創建專案失敗，請稍後再試"
          );
        });
    },
  },
  mounted() {
    this.fetchOwnerProjects();
    this.fetchCategories();
    this.fetchUsers();
    this.fetchYears();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
