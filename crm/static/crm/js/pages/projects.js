const projectList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      projects: [],
      owners: [], // 業主資料
      categories: [], // 類別資料
      users: [], // 用戶資料
      projectManagers: [], // 專案負責人列表
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
      pageSize: 10, // 修改為10,與payments頁面一致
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
      
      // 新增：動態載入相關的狀態
      loadingOwnerIds: new Set(), // 正在載入的業主ID集合
      
      // 業主選擇modal相關資料
      selectedOwner: null, // 選中的業主
      modalOwners: [], // modal中的業主列表
      ownerModalSearchTerm: "", // 搜尋關鍵字
      isLoadingOwners: false, // 載入狀態
      ownerPagination: null, // 分頁資訊
      currentOwnerPage: 1, // 目前頁數
      
      // 錯誤處理
      projectNumberError: '', // 案件編號錯誤訊息
      formErrors: {}, // 表單其他錯誤訊息
      
      // 移除重複的宣告
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
            this.fetchProjects(this.currentPage); // 重新獲取當前頁數據
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
        }
      });
    },
    editProject(project) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editProjectId = project.id;

      // 只複製基本欄位
      this.newProject = {
        category: project.category,
        year: project.year,
        project_number: project.project_number,
        name: project.name,
        owner: project.owner,
      };

      // 設置選中的業主
      if (project.owner && this.ownerMap[project.owner]) {
        this.selectedOwner = this.ownerMap[project.owner];
      } else {
        this.selectedOwner = null;
      }

      // 顯示模態框
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
      
      // modal 顯示後自動focus到第一個輸入欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.ownerInput) {
            this.$refs.ownerInput.focus();
          }
        });
      }, { once: true });

      // 關閉下拉選單
      this.activeMenu = null;
    },
    viewInvoices(projectId) {
      // 導航到詢專案的請款列表頁面
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
          
          // 動態載入缺失的業主資訊
          this.loadMissingOwners();
        })
        .catch((error) => console.error("Error fetching projects:", error))
        .finally(() => {
          this.isLoading = false;
        });
    },
    fetchOwners() {
      // 只載入基本的業主資料用於搜尋和新增專案
      fetch(`/crm/api/owners/?format=json&page_size=500`)
        .then((response) => response.json())
        .then((data) => {
          this.owners = data.results;
        })
        .catch((error) => console.error("Error fetching owners:", error));
    },
    
    // 新增方法：動態載入缺失的業主資訊
    loadMissingOwners() {
      // 收集當前頁面中缺失的業主ID（考慮 owner_name 為空的情況）
      const missingOwnerIds = [];
      this.projects.forEach(project => {
        // 如果沒有 owner_name 且有 owner ID，並且不在 ownerMap 中
        if (project.owner && !project.owner_name && !this.ownerMap[project.owner]) {
          missingOwnerIds.push(project.owner);
        }
      });
      
      // 去重
      const uniqueMissingIds = [...new Set(missingOwnerIds)];
      
      if (uniqueMissingIds.length > 0) {
        console.log(`正在載入 ${uniqueMissingIds.length} 個缺失的業主資訊...`);
        
        // 批量獲取業主資訊
        fetch(`/crm/api/owners/batch_info/?ids=${uniqueMissingIds.join(',')}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
          })
          .then(ownerData => {
            // 將新獲取的業主資訊添加到 owners 陣列中
            Object.entries(ownerData).forEach(([ownerId, companyName]) => {
              // 檢查是否已存在，避免重複
              const existingOwner = this.owners.find(owner => owner.id == ownerId);
              if (!existingOwner) {
                this.owners.push({
                  id: parseInt(ownerId),
                  company_name: companyName
                });
              }
            });
            console.log(`成功載入 ${Object.keys(ownerData).length} 個業主資訊`);
          })
          .catch(error => {
            console.error("Error loading missing owners:", error);
            // 將失敗的ID添加一個錯誤標記，避免重複嘗試
            uniqueMissingIds.forEach(ownerId => {
              if (!this.owners.find(owner => owner.id == ownerId)) {
                this.owners.push({
                  id: parseInt(ownerId),
                  company_name: "載入失敗"
                });
              }
            });
          });
      }
    },

    // 新增方法：載入單一業主資訊
    loadOwnerById(ownerId) {
      // 避免重複載入
      if (this.loadingOwnerIds && this.loadingOwnerIds.has(ownerId)) {
        return;
      }
      
      // 初始化載入中的ID集合
      if (!this.loadingOwnerIds) {
        this.loadingOwnerIds = new Set();
      }
      
      this.loadingOwnerIds.add(ownerId);
      
      fetch(`/crm/api/owners/batch_info/?ids=${ownerId}`)
        .then(response => response.json())
        .then(ownerData => {
          Object.entries(ownerData).forEach(([id, companyName]) => {
            // 檢查是否已存在，避免重複
            if (!this.owners.find(owner => owner.id == id)) {
              this.owners.push({
                id: parseInt(id),
                company_name: companyName
              });
            }
          });
        })
        .catch(error => console.error("Error loading owner:", error))
        .finally(() => {
          this.loadingOwnerIds.delete(ownerId);
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
      // 首先檢查是否已經有這個業主的資訊
      if (this.ownerMap[ownerId]) {
        return this.ownerMap[ownerId].company_name;
      }
      
      // 如果沒有，觸發動態載入
      this.loadOwnerById(ownerId);
      
      // 暫時返回載入中的提示
      return "載入中...";
    },
    getCategoryName(categoryId) {
      const category = this.categoryMap[categoryId];
      return category ? `${category.code}: ${category.description}` : "未分類";
    },
    getCategoryCode(categoryId) {
      if (!categoryId) return "N";
      const category = this.categoryMap[categoryId];
      return category ? category.code : "N";
    },
    getManagerName(managerId) {
      const manager = this.userMap[managerId];
      console.log(manager);
      return manager ? manager.profile.name || manager.username : "未指派";
    },
    getStatusBadgeClass(project) {
      return project.is_completed
        ? "badge-success"
        : "badge-warning";
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

      // 重置為簡化的表單數據，只保留最基本的欄位
      this.newProject = {
        owner: "",
        category: "",
        year: new Date().getFullYear(),
        project_number: "", // 加入案件編號欄位
        name: "",
      };

      // 清空業主選擇
      this.selectedOwner = null;
      
      // 清除錯誤訊息
      this.clearErrors();

      // 使用 Bootstrap 的 Modal API 顯示
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
      
      // modal 顯示後自動focus到第一個輸入欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.ownerInput) {
            this.$refs.ownerInput.focus();
          }
        });
      }, { once: true });
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
      
      // 清除錯誤訊息
      this.clearErrors();

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addProjectModal")
      );
      modal.hide();
    },
    submitProjectForm() {
      // 清除之前的錯誤訊息
      this.projectNumberError = '';
      this.formErrors = {};
      
      // 如果未選擇業主，顯示錯誤訊息
      if (!this.selectedOwner) {
        Swal.fire({
          title: "表單驗證失敗!",
          text: "請選擇或新增業主",
          icon: "warning",
          confirmButtonText: "確定",
        });
        return;
      }

      // 簡化的表單提交，只包含基本欄位
      const formData = {
        owner: this.selectedOwner.id,
        category: this.newProject.category,
        year: parseInt(this.newProject.year) || new Date().getFullYear(),
        name: this.newProject.name,
      };

      // 加入案件編號（如果有手動輸入）
      if (this.newProject.project_number && this.newProject.project_number.trim()) {
        formData.project_number = this.newProject.project_number.trim();
      }

      // 如果是編輯模式且已有專案編號，則保留它
      if (this.isEditMode && this.newProject.project_number) {
        // 在編輯模式下，我們不修改 project_number，讓它維持原樣
        // DRF 會忽略此欄位，因為我們已將其設為 read_only
      }

      // 如果有專案負責人權限，則新增至這個專案中
      if (window.CURRENT_USER_DATA && window.CURRENT_USER_DATA.profile.is_project_manager) {
        formData.managers = [window.CURRENT_USER_DATA.id];
      }

      const url = this.isEditMode
        ? `/crm/api/projects/${this.editProjectId}/`
        : "/crm/api/projects/";
      const method = this.isEditMode ? "PATCH" : "POST";

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
              throw err; // 直接拋出錯誤物件而不是字串化
            });
          }
          return response.json();
        })
        .then((_data) => {
          this.hideAddProjectModal(); // 提交成功後關閉 Modal

          if (this.isEditMode) {
            // 如果是編輯模式，重新載入專案列表
            this.fetchProjects(this.currentPage);
          } else {
            // 如果是新增模式，導航到專案詳情頁進行完整編輯
            window.location.href = `/crm/project/${_data.id}/details/`;
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          
          // 處理唯一性約束錯誤 (年份、分類、案件編號的組合必須唯一)
          if (error.non_field_errors) {
            const nonFieldError = Array.isArray(error.non_field_errors) 
              ? error.non_field_errors[0] 
              : error.non_field_errors;
            
            if (nonFieldError.includes("The fields year, category, project_number must make a unique set")) {
              this.projectNumberError = "此案件編號在相同年份和分類下已存在，請使用不同的案件編號";
              return;
            }
            
            // 其他 non_field_errors
            this.projectNumberError = this.translateErrorMessage(nonFieldError);
            return;
          }
          
          // 處理案件編號重複錯誤
          if (error.project_number) {
            const projectNumberError = Array.isArray(error.project_number) 
              ? error.project_number[0] 
              : error.project_number;
            this.projectNumberError = this.translateErrorMessage(projectNumberError);
            return; // 不顯示 SweetAlert，只顯示表單內的錯誤訊息
          }
          
          // 處理一般錯誤訊息
          if (error.error) {
            this.projectNumberError = this.translateErrorMessage(error.error);
            return;
          }
          
          // 處理其他錯誤
          let errorMessage = "未知錯誤";
          if (error.message) {
            errorMessage = this.translateErrorMessage(error.message);
          } else if (typeof error === 'string') {
            errorMessage = this.translateErrorMessage(error);
          } else if (error.detail) {
            errorMessage = this.translateErrorMessage(error.detail);
          }
          
          Swal.fire({
            title: "錯誤!",
            text: this.isEditMode
              ? `更新專案失敗：${errorMessage}`
              : `創建專案失敗：${errorMessage}`,
            icon: "error",
            confirmButtonText: "確定",
          });
        });
    },
    
    // 清除錯誤訊息
    clearErrors() {
      this.projectNumberError = '';
      this.formErrors = {};
    },
    
    // 清除案件編號錯誤訊息
    clearProjectNumberError() {
      this.projectNumberError = '';
    },

    // 翻譯錯誤訊息為中文
    translateErrorMessage(message) {
      if (!message) return "未知錯誤";
      
      const errorTranslations = {
        // 唯一性約束錯誤
        "The fields year, category, project_number must make a unique set.": "此案件編號在相同年份和分類下已存在，請使用不同的案件編號",
        "Project with this Year, Category and Project number already exists.": "此案件編號在相同年份和分類下已存在，請使用不同的案件編號",
        
        // 案件編號相關錯誤
        "Project number already exists for this year and category.": "此案件編號在相同年份和分類下已存在",
        "This field must be unique.": "此欄位必須是唯一的",
        "Duplicate entry": "重複項目",
        
        // 表單驗證錯誤
        "This field is required.": "此欄位為必填",
        "This field may not be blank.": "此欄位不能為空",
        "Ensure this field has no more than": "請確保此欄位不超過",
        "characters.": "個字元",
        
        // 權限錯誤
        "You do not have permission to perform this action.": "您沒有權限執行此操作",
        "Authentication credentials were not provided.": "未提供身份驗證憑證",
        
        // 網路錯誤
        "Network error": "網路錯誤",
        "Server error": "伺服器錯誤",
        "Connection failed": "連線失敗",
        
        // 一般錯誤
        "Invalid input": "輸入無效",
        "Bad request": "請求錯誤",
        "Not found": "找不到資源",
        "Internal server error": "內部伺服器錯誤"
      };
      
      // 完全匹配
      if (errorTranslations[message]) {
        return errorTranslations[message];
      }
      
      // 部分匹配檢查
      for (const [englishText, chineseText] of Object.entries(errorTranslations)) {
        if (message.toLowerCase().includes(englishText.toLowerCase())) {
          return chineseText;
        }
      }
      
      // 檢查是否包含特定關鍵字
      if (message.toLowerCase().includes("unique") && message.toLowerCase().includes("already exists")) {
        return "此項目已存在，請使用不同的值";
      }
      
      if (message.toLowerCase().includes("duplicate")) {
        return "重複的項目，請檢查輸入的值";
      }
      
      if (message.toLowerCase().includes("required")) {
        return "必填欄位不能為空";
      }
      
      if (message.toLowerCase().includes("invalid")) {
        return "輸入的資料格式不正確";
      }
      
      // 如果沒有找到匹配的翻譯，返回原始訊息
      return message;
    },

    // 業主搜尋和選擇 (已廢棄，保留作為參考)
    /*
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
    */

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
      
      // modal 顯示後自動focus到第一個輸入欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.ownerCompanyNameInput) {
            this.$refs.ownerCompanyNameInput.focus();
          }
        });
      }, { once: true });
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
          this.selectedOwner = data;
          this.newProject.owner = data.id;

          // 如果modal已開啟，更新modal中的業主列表
          if (this.modalOwners.length > 0) {
            this.loadOwners();
          }

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
    // 處理每頁數量變更
    pageSizeChanged() {
      this.currentPage = 1; // 更改每頁數量時重置為第一頁
      this.fetchProjects(1);
    },
    // 重設篩選條件
    resetFilters() {
      this.categoryFilter = "";
      this.completedFilter = "";
      this.startYearFilter = "";
      this.endYearFilter = "";
      this.fetchProjects(1);
    },

    // 業主選擇modal相關方法
    showOwnerSelectionModal() {
      // 顯示業主選擇modal
      const modal = new bootstrap.Modal(
        document.getElementById("selectOwnerModal")
      );
      modal.show();
      
      // 載入業主列表
      this.loadOwners();
      
      // modal 顯示後自動focus到搜尋欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.ownerModalSearchInput) {
            this.$refs.ownerModalSearchInput.focus();
          }
        });
      }, { once: true });
    },

    hideOwnerSelectionModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("selectOwnerModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    loadOwners(url = null) {
      this.isLoadingOwners = true;
      
      // 如果沒有提供URL，則構建預設的API URL
      if (!url) {
        url = `/crm/api/owners/?format=json&page=${this.currentOwnerPage}&page_size=10`;
        
        // 添加搜尋條件
        if (this.ownerModalSearchTerm) {
          url += `&search=${encodeURIComponent(this.ownerModalSearchTerm)}`;
        }
      }
      
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.modalOwners = data.results;
          this.ownerPagination = {
            count: data.count,
            next: data.next,
            previous: data.previous
          };
          
          // 從URL中解析當前頁碼
          if (url.includes('page=')) {
            const pageMatch = url.match(/page=(\d+)/);
            if (pageMatch) {
              this.currentOwnerPage = parseInt(pageMatch[1]);
            }
          }
        })
        .catch((error) => {
          console.error("Error loading owners:", error);
          this.modalOwners = [];
        })
        .finally(() => {
          this.isLoadingOwners = false;
        });
    },

    searchOwners() {
      // 重置頁碼並搜尋
      this.currentOwnerPage = 1;
      this.loadOwners();
    },

    selectOwnerFromModal(owner) {
      // 選擇業主並設定到selectedOwner
      this.selectedOwner = owner;
      this.newProject.owner = owner.id;
      
      // 關閉modal
      this.hideOwnerSelectionModal();
    },

    getOwnerPageNumbers() {
      if (!this.ownerPagination) return [];
      
      const totalPages = Math.ceil(this.ownerPagination.count / 10);
      const current = this.currentOwnerPage;
      const delta = 2;
      let pages = [];

      for (let i = 1; i <= totalPages; i++) {
        if (
          i === 1 ||
          i === totalPages ||
          (i >= current - delta && i <= current + delta)
        ) {
          pages.push(i);
        }
      }

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

    goToOwnerPage(page) {
      if (page === '...' || page === this.currentOwnerPage) return;
      
      this.currentOwnerPage = page;
      this.loadOwners();
    },
  },
  mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    
    if (searchQuery) {
      this.searchQuery = decodeURIComponent(searchQuery);
      this.fetchProjects(); // 使用搜尋條件獲取專案列表
    }
    
    this.fetchProjects();
    this.fetchOwners();
    this.fetchCategories();
    this.fetchUsers();
    this.fetchYears();
    document.addEventListener("click", this.handleClickOutside);
    
    // 頁面載入後自動focus到搜尋欄位
    this.$nextTick(() => {
      this.$refs.searchInput.focus();
      console.log("自動focus到搜尋欄位");
        
    });
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
