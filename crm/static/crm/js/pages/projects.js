const projectList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      projects: [],
      owners: [], // 業主資料
      categories: [], // 類別資料
      users: [], // 用戶資料
      projectManagers: [], // 專案經理列表
      designers: [], // 設計師列表
      isLoading: false,
      searchQuery: "",
      categoryFilter: "",
      completedFilter: "",
      startYearFilter: "", // 開始年份
      endYearFilter: "", // 結束年份
      activeMenu: null,
      currentPage: 1,
      totalPages: 1,
      pageSize: 5, // 每頁顯示的項目數，可調整
      menuPosition: {
        x: 0,
        y: 0,
      },
      showModal: false,
      isEditMode: false,
      editProjectId: null,
      availableYears: [], // 資料庫中現有的年份
      minYear: null, // 最小年份
      maxYear: null, // 最大年份
      newProject: {
        owner: "",
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
        expenditure: 0, // 確保有預設值
        is_invoiced: false,
        invoice_date: null,
        invoice_amount: null,
        payment_date: null,
        invoice_issue_date: null,
        invoice_notes: "",
        is_paid: false,
      },
      // 新增業主相關資料
      newOwner: {
        company_name: "",
        tax_id: "",
        contact_person: "",
        phone: "",
        address: "",
        email: "",
        notes: "",
      },
      // Autocomplete 相關資料
      ownerSearchTerm: "",
      managerSearchTerm: "",
      designerSearchTerm: "",
      showOwnerDropdown: false,
      showManagerDropdown: false,
      showDesignerDropdown: false,
      filteredOwners: [],
      filteredManagers: [],
      filteredDesigners: [],
    };
  },
  computed: {
    ownerMap() {
      return this.owners.reduce((acc, owner) => {
        acc[owner.id] = owner;
        return acc;
      }, {});
    },
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
    // 計算年份範圍
    yearRange() {
      // 如果沒有設定最小或最大年份，返回可用年份列表
      if (this.minYear === null || this.maxYear === null) {
        return this.availableYears;
      }

      // 創建從最小年份到最大年份的連續數組
      const range = [];
      for (let year = this.minYear; year <= this.maxYear; year++) {
        range.push(year);
      }

      // 按降序排列（最近的年份在前）
      return range.sort((a, b) => b - a);
    },
  },
  directives: {
    // 自定義指令：點擊元素外部時觸發
    clickOutside: {
      mounted(el, binding) {
        el._clickOutside = (event) => {
          if (!(el === event.target || el.contains(event.target))) {
            binding.value(event);
          }
        };
        document.addEventListener("click", el._clickOutside);
      },
      unmounted(el) {
        document.removeEventListener("click", el._clickOutside);
      },
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
            this.fetchProjects(this.currentPage); // 重新獲取當前頁數據
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

      // 設置對應的搜尋項的值
      if (project.owner && this.ownerMap[project.owner]) {
        this.ownerSearchTerm = this.ownerMap[project.owner].company_name;
      } else {
        this.ownerSearchTerm = "";
      }

      if (project.manager && this.userMap[project.manager]) {
        this.managerSearchTerm =
          this.userMap[project.manager].profile.name ||
          this.userMap[project.manager].username;
      } else {
        this.managerSearchTerm = "";
      }

      if (project.drawing && this.userMap[project.drawing]) {
        this.designerSearchTerm =
          this.userMap[project.drawing].profile.name ||
          this.userMap[project.drawing].username;
      } else {
        this.designerSearchTerm = "";
      }

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
    fetchProjects(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/projects/?format=json&page=${page}&page_size=${this.pageSize}`;

      // 添加搜尋條件
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      // 添加過濾條件
      if (this.categoryFilter) {
        url += `&category=${this.categoryFilter}`;
      }

      if (this.completedFilter === "completed") {
        url += `&is_completed=true`;
      } else if (this.completedFilter === "in_progress") {
        url += `&is_completed=false`;
      }

      // 使用年份區間過濾
      if (this.startYearFilter) {
        url += `&year_start=${this.startYearFilter}`;
      }

      if (this.endYearFilter) {
        url += `&year_end=${this.endYearFilter}`;
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
    fetchOwners() {
      fetch(`/crm/api/owners/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.owners = data.results;
        })
        .catch((error) => console.error("Error fetching owners:", error));
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
      // 獲取所有可用的年份和年份範圍
      fetch(`/crm/api/projects/years/`)
        .then((response) => response.json())
        .then((data) => {
          this.availableYears = data.years;
          this.minYear = data.min_year;
          this.maxYear = data.max_year;

          // 確保當前年份也包含在內
          const currentYear = new Date().getFullYear();
          if (currentYear > this.maxYear) {
            this.maxYear = currentYear;
          }
        })
        .catch((error) => {
          console.error("Error fetching years:", error);
          // 如果獲取失敗，提供當前年份作為預設值
          const currentYear = new Date().getFullYear();
          this.minYear = currentYear;
          this.maxYear = currentYear;
          this.availableYears = [currentYear];
        });
    },
    getOwnerName(ownerId) {
      return this.ownerMap[ownerId]?.company_name || "未知業主";
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
        owner: "",
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
        expenditure: 0, // 確保有預設值
        is_invoiced: false,
        invoice_date: null,
        invoice_amount: null,
        payment_date: null,
        invoice_issue_date: null,
        invoice_notes: "",
        is_paid: false,
      };

      // 重置搜尋欄位
      this.ownerSearchTerm = "";
      this.managerSearchTerm = "";
      this.designerSearchTerm = "";

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

      // 確保數值型欄位轉換為數字
      formData.expenditure = parseFloat(formData.expenditure) || 0;
      formData.change_count = parseInt(formData.change_count) || 0;
      formData.year = parseInt(formData.year) || new Date().getFullYear();

      // 確保空字符串欄位設置為空字符串而非 null
      formData.contact_info = formData.contact_info || "";
      formData.change_description = formData.change_description || "";
      formData.notes = formData.notes || "";
      formData.drawing_other = formData.drawing_other || "";

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
            return response.json().then((err) => {
              throw new Error(JSON.stringify(err));
            });
          }
          return response.json();
        })
        .then(() => {
          this.hideAddProjectModal(); // 提交成功後關閉 Modal
          this.fetchProjects(this.currentPage); // 刷新專案列表
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(
            this.isEditMode
              ? `更新專案失敗：${error.message}`
              : `創建專案失敗：${error.message}`
          );
        });
    },
    // 業主搜尋和選擇
    filterOwners() {
      if (!this.ownerSearchTerm) {
        this.filteredOwners = this.owners.slice(0, 10); // 顯示前10個
        return;
      }

      const searchTerm = this.ownerSearchTerm.toLowerCase();
      this.filteredOwners = this.owners
        .filter(
          (owner) =>
            owner.company_name.toLowerCase().includes(searchTerm) ||
            (owner.tax_id && owner.tax_id.includes(searchTerm))
        )
        .slice(0, 10); // 最多顯示10個結果
    },

    selectOwner(owner) {
      this.newProject.owner = owner.id;
      this.ownerSearchTerm = owner.company_name;
      this.showOwnerDropdown = false;
    },

    closeOwnerDropdown() {
      this.showOwnerDropdown = false;

      // 如果已選擇了業主ID但輸入框被清空，則重設業主ID
      if (this.newProject.owner && !this.ownerSearchTerm) {
        this.newProject.owner = "";
      }

      // 如果有業主ID，確保顯示正確的業主名稱
      if (this.newProject.owner && this.ownerMap[this.newProject.owner]) {
        this.ownerSearchTerm =
          this.ownerMap[this.newProject.owner].company_name;
      }
    },

    // 專案負責人搜尋和選擇
    filterManagers() {
      if (!this.managerSearchTerm) {
        this.filteredManagers = this.projectManagers.slice(0, 10);
        return;
      }

      const searchTerm = this.managerSearchTerm.toLowerCase();
      this.filteredManagers = this.projectManagers
        .filter(
          (user) =>
            (user.profile.name &&
              user.profile.name.toLowerCase().includes(searchTerm)) ||
            user.username.toLowerCase().includes(searchTerm)
        )
        .slice(0, 10);
    },

    selectManager(manager) {
      this.newProject.manager = manager.id;
      this.managerSearchTerm = manager.profile.name || manager.username;
      this.showManagerDropdown = false;
    },

    closeManagerDropdown() {
      this.showManagerDropdown = false;

      // 如果已選擇了負責人ID但輸入框被清空，則重設負責人ID
      if (this.newProject.manager && !this.managerSearchTerm) {
        this.newProject.manager = "";
      }

      // 如果有負責人ID，確保顯示正確的負責人名稱
      if (this.newProject.manager) {
        const manager = this.userMap[this.newProject.manager];
        if (manager) {
          this.managerSearchTerm = manager.profile.name || manager.username;
        }
      }
    },

    // 設計師搜尋和選擇
    filterDesigners() {
      if (!this.designerSearchTerm) {
        this.filteredDesigners = this.designers.slice(0, 10);
        return;
      }

      const searchTerm = this.designerSearchTerm.toLowerCase();
      this.filteredDesigners = this.designers
        .filter(
          (user) =>
            (user.profile.name &&
              user.profile.name.toLowerCase().includes(searchTerm)) ||
            user.username.toLowerCase().includes(searchTerm)
        )
        .slice(0, 10);
    },

    selectDesigner(designer) {
      this.newProject.drawing = designer.id;
      this.designerSearchTerm = designer.profile.name || designer.username;
      this.showDesignerDropdown = false;
    },

    closeDesignerDropdown() {
      this.showDesignerDropdown = false;

      // 如果已選擇了設計師ID但輸入框被清空，則重設設計師ID
      if (this.newProject.drawing && !this.designerSearchTerm) {
        this.newProject.drawing = "";
      }

      // 如果有設計師ID，確保顯示正確的設計師名稱
      if (this.newProject.drawing) {
        const designer = this.userMap[this.newProject.drawing];
        if (designer) {
          this.designerSearchTerm = designer.profile.name || designer.username;
        }
      }
    },

    // 顯示新增業主Modal
    showAddOwnerModal() {
      // 如果從搜尋業主時點擊新增，則預填公司名稱
      if (this.ownerSearchTerm) {
        this.newOwner.company_name = this.ownerSearchTerm;
      } else {
        // 重置新業主表單
        this.newOwner = {
          company_name: "",
          tax_id: "",
          contact_person: "",
          phone: "",
          address: "",
          email: "",
          notes: "",
        };
      }

      // 關閉業主下拉選單
      this.showOwnerDropdown = false;

      // 顯示新增業主Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addOwnerModal")
      );
      modal.show();
    },

    // 隱藏新增業主Modal
    hideAddOwnerModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addOwnerModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 提交新增業主表單
    submitOwnerForm() {
      fetch("/crm/api/owners/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(this.newOwner),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => {
              throw new Error(JSON.stringify(err));
            });
          }
          return response.json();
        })
        .then((data) => {
          // 新增業主成功後，更新業主列表
          this.owners.push(data);

          // 選擇新增的業主
          this.selectOwner(data);

          // 更新業主搜尋結果
          this.filterOwners();

          // 關閉Modal
          this.hideAddOwnerModal();

          // 顯示成功提示
          alert(`業主「${data.company_name}」新增成功`);
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(`創建業主失敗：${error.message}`);
        });
    },
  },
  mounted() {
    this.fetchProjects();
    this.fetchOwners();
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
