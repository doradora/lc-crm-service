const ownerProjectsApp = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      projects: [],
      categories: [],
      users: [], // 添加 users 數據
      designers: [],
      projectManagers: [],
      isLoading: false,
      searchQuery: "",
      categoryFilter: "",
      yearFilter: "",
      currentPage: 1,
      totalPages: 1,
      pageSize: 10,
      availableYears: [],
      activeMenu: null,
      menuPosition: {
        x: 0,
        y: 0,
      }, // 添加菜單位置
      newProject: {
        owner: OWNER_ID,
        category: "",
        year: new Date().getFullYear(),
        name: "",
        manager: "",
        drawing: "",
        drawing_other: "",
        contact_info: "",
        change_count: 0,
        is_completed: false,
        change_description: "",
        notes: "",
        expenditure: 0,
      },
      isEditMode: false,
      editProjectId: null, // 添加編輯專案 ID
    };
  },
  computed: {
    // 添加 categoryMap 計算屬性
    categoryMap() {
      return this.categories.reduce((acc, category) => {
        acc[category.id] = category;
        return acc;
      }, {});
    },
    // 添加 userMap 計算屬性
    userMap() {
      return this.users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
    },
    // 計算需要顯示的頁碼
    displayedPages() {
      const total = this.totalPages;
      const current = this.currentPage;
      const delta = 2; // 當前頁的左右顯示頁數
      let pages = [];

      // 計算應該顯示哪些頁碼
      for (let i = 1; i <= total; i++) {
        if (
          i === 1 ||
          i === total ||
          (i >= current - delta && i <= current + delta)
        ) {
          pages.push(i);
        }
      }

      // 添加省略號
      let result = [];
      let prev = 0;
      for (let page of pages) {
        if (prev && page > prev + 1) {
          result.push("...");
        }
        result.push(page);
        prev = page;
      }
      return result;
    },
  },
  methods: {
    fetchOwnerProjects(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      // 修正 API 路徑，使用正確的查詢參數獲取特定業主的專案
      let url = `/crm/api/projects/?format=json&page=${page}&page_size=${this.pageSize}&owner=${OWNER_ID}`;

      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      if (this.categoryFilter) {
        url += `&category=${this.categoryFilter}`;
      }

      if (this.yearFilter) {
        url += `&year=${this.yearFilter}`;
      }

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          this.projects = data.results;
          this.totalPages = Math.ceil(data.count / 10); // 假設每頁顯示 10 筆資料

          // 從項目中提取年份並去重
          const years = [
            ...new Set(this.projects.map((project) => project.year)),
          ];
          this.availableYears = years.sort((a, b) => b - a); // 降序排列年份
        })
        .catch((error) => {
          console.error("Error fetching projects:", error);
          // 顯示錯誤提示
          this.isLoading = false;
          // 如果環境允許，可以顯示一個錯誤通知
        })
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
    // 修正 getCategoryName 方法
    getCategoryName(categoryId) {
      const category = this.categoryMap[categoryId];
      return category ? `${category.code}: ${category.description}` : "未分類";
    },
    // 修正 getManagerName 方法
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
    getMenuStyle(projectId) {
      if (this.activeMenu !== projectId) {
        return { display: "none" };
      }
      return {
        position: "fixed",
        inset: "0px auto auto 0px",
        margin: "0px",
        transform: `translate(${this.menuPosition.x}px, ${this.menuPosition.y}px)`,
        "z-index": "107",
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
    showAddProjectModal() {
      this.isEditMode = false;
      this.newProject = {
        owner: OWNER_ID,
        category: "",
        year: new Date().getFullYear(),
        name: "",
        manager: "",
        drawing: "",
        drawing_other: "",
        contact_info: "",
        change_count: 0,
        is_completed: false,
        change_description: "",
        notes: "",
        expenditure: 0,
      };
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
    },
    hideAddProjectModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addProjectModal")
      );
      modal.hide();
    },
    editProject(project) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editProjectId = project.id;

      // 複製專案數據
      this.newProject = { ...project };

      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },
    submitProjectForm() {      // 添加表單驗證
      if (
        !this.newProject.category ||
        !this.newProject.name ||
        !this.newProject.manager
      ) {
        Swal.fire({
          title: "表單驗證失敗!",
          text: "請填寫所有必填欄位!",
          icon: "warning",
          confirmButtonText: "確定",
        });
        return;
      }

      const url = this.isEditMode
        ? `/crm/api/projects/${this.newProject.id}/`
        : `/crm/api/projects/`;
      const method = this.isEditMode ? "PUT" : "POST";

      // 確保CSRF令牌正確獲取
      const csrfToken = document.querySelector(
        '[name="csrfmiddlewaretoken"]'
      )?.value;
      if (!csrfToken) {
        console.error("無法獲取CSRF令牌");
        return;
      }

      // 如果是新增專案且當前使用者有專案經理權限，則自動加入為專案經理
      const projectData = { ...this.newProject };
      if (window.CURRENT_USER_DATA && window.CURRENT_USER_DATA.profile.is_project_manager) {
        // 確保 managers 是陣列，並加入當前使用者
        if (!projectData.managers) {
          projectData.managers = [];
        } else if (!Array.isArray(projectData.managers)) {
          projectData.managers = [];
        }
        // 避免重複加入
        if (!projectData.managers.includes(window.CURRENT_USER_DATA.id)) {
          projectData.managers.push(window.CURRENT_USER_DATA.id);
        }
      }

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify(projectData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              throw new Error(JSON.stringify(data) || "提交失敗");
            });
          }
          return response.json();
        })
        .then(() => {
          this.fetchOwnerProjects(this.currentPage);
          this.hideAddProjectModal();
          // 顯示成功消息
          Swal.fire({
            title: "成功!",
            text: this.isEditMode ? "專案更新成功!" : "專案創建成功!",
            icon: "success",
            confirmButtonText: "確定",
          });
        })        .catch((error) => {
          console.error("Error submitting project:", error);
          Swal.fire({
            title: "錯誤!",
            text: "提交失敗: " + error.message,
            icon: "error",
            confirmButtonText: "確定",
          });
        });
    },
    deleteProject(projectId) {
      // 檢查使用者權限：必須是管理員或該專案的經理
      if (!window.CURRENT_USER_DATA) {
        Swal.fire({
          title: "無權限!",
          text: "您沒有權限刪除專案！",
          icon: "warning",
          confirmButtonText: "確定",
        });
        return;
      }

      const currentUserId = Number(window.CURRENT_USER_DATA.id);
      const isAdmin = window.CURRENT_USER_DATA.profile.is_admin;
        // 找到要刪除的專案
      const projectToDelete = this.projects.find(p => p.id === projectId);
      if (!projectToDelete) {
        Swal.fire({
          title: "錯誤!",
          text: "找不到指定的專案！",
          icon: "error",
          confirmButtonText: "確定",
        });
        return;
      }

      // 檢查是否為該專案的經理
      const isProjectManager = projectToDelete.managers && projectToDelete.managers.includes(currentUserId);
      
      // 只有管理員或該專案的經理可以刪除
      if (!isAdmin && !isProjectManager) {
        Swal.fire({
          title: "無權限!",
          text: "您沒有權限刪除此專案！只有管理員或該專案的經理可以執行此操作。",
          icon: "warning",
          confirmButtonText: "確定",
        });
        return;
      }

      Swal.fire({
        title: "確認刪除",
        text: "確定要刪除此專案嗎？此操作無法還原！",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "刪除",
        cancelButtonText: "取消",
      }).then((result) => {
        if (result.isConfirmed) {
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
            this.fetchOwnerProjects(this.currentPage);
          })
          .catch((error) => console.error("Error deleting project:", error));
        }
      });
    },
    viewQuotations(projectId) {
      window.location.href = `/crm/project/${projectId}/quotations/`;
      // 關閉下拉選單
      this.activeMenu = null;
    },
    viewInvoices(projectId) {
      window.location.href = `/crm/payments/?project=${projectId}`;
      // 關閉下拉選單
      this.activeMenu = null;
    },
    viewProjectDetails(projectId) {
      // 導航到該專案的詳情頁面
      window.location.href = `/crm/project/${projectId}/details/`;
      // 關閉下拉選單
      this.activeMenu = null;
    },
  },
  mounted() {
    this.fetchOwnerProjects();
    this.fetchCategories();
    this.fetchUsers();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
