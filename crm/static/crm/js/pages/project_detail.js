const projectDetail = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      // 專案資料
      project: {
        id: null,
        owner: "",
        category: "",
        category_detail: {},
        year: new Date().getFullYear(),
        project_number: "",
        name: "",
        managers: [], // 儲存專案負責人IDs
        selected_managers: [], // 儲存完整的專案負責人資料
        supervisors: [], // 儲存監造人員IDs
        selected_supervisors: [], // 儲存完整的監造人員資料
        drawing: "",
        drawing_other: "",
        contact_info: "",
        change_count: 0,
        change_description: "",
        notes: "",
        status: 'in_progress', // 新增狀態欄位
        is_completed: false, // 保留向後相容
        expenditure: 0,
        is_invoiced: false,
        invoice_date: null,
        invoice_amount: null,
        payment_date: null,
        invoice_issue_date: null,
        invoice_notes: "",
        is_paid: false,
        expenditures: [], // 添加支出記錄陣列
        total_expenditure: 0, // 添加總支出金額
        report_name: "",
      },

      // 其他數據
      projectId: null,
      owners: [],
      categories: [],
      users: [],
      projectManagers: [],
      currentUser: {},

      // 自定義欄位相關
      categoryFields: {}, // 類別定義的欄位結構
      customFieldValues: {}, // 專案中的自定義欄位值

      // 搜尋與下拉選單相關數據
      ownerSearchTerm: "",
      managerSearchTerm: "",
      supervisorSearchTerm: "",
      showOwnerDropdown: false,
      showManagerDropdown: false,
      showSupervisorDropdown: false,
      filteredOwners: [],
      filteredManagers: [],
      filteredSupervisors: [],

      // 業主選擇 Modal 相關數據
      ownerModalSearchTerm: "",
      modalOwners: [],
      isLoadingOwners: false,
      ownerPagination: null,
      currentOwnerPage: 1,
      searchTimeout: null,

      // 新增業主相關數據
      newOwner: {
        company_name: "",
        tax_id: "",
        contact_person: "",
        phone: "",
        mobile: "",
        fax: "",
        address: "",
        email: "",
      },

      // 標籤頁相關
      activeTab: "tab_basic_info",

      // 新增支出相關數據
      newExpenditure: {
        date: new Date().toISOString().slice(0, 10), // 預設為今天
        amount: 0,
        description: "",
      },
      isEditingExpenditure: false, // 是否在編輯支出記錄
      editingExpenditureId: null, // 正在編輯的支出記錄ID

      // 新增變更記錄相關數據
      newChange: {
        description: "",
        created_at: new Date().toISOString().slice(0, 10), // 預設為今天
      },
      isEditingChange: false, // 是否在編輯變更記錄
      editingChangeId: null, // 正在編輯的變更記錄ID

      // 新增編輯模式狀態
      isEditMode: false,

      // 控制必填欄位紅框顯示
      showRequiredFieldErrors: false,
    };
  },
  computed: {
    // 獲取專案狀態顯示樣式
    getStatusBadgeClass() {
      const statusMap = {
        'in_progress': 'badge-warning',   // 黃色
        'paused': 'badge-info',            // 藍色
        'completed': 'badge-success',      // 綠色
        'cancelled': 'badge-danger'        // 紅色
      };
      return statusMap[this.project.status] || 'badge-secondary';
    },

    // 獲取專案狀態文字
    getStatusText() {
      const textMap = {
        'in_progress': '進行中',
        'paused': '暫停',
        'completed': '已完成',
        'cancelled': '撤案'
      };
      return textMap[this.project.status] || '未知';
    },

    // 獲取業主名稱
    getOwnerName() {
      const owner = this.owners.find(
        (owner) => owner.id === this.project.owner
      );
      return owner ? owner.company_name : "未指定業主";
    },

    // 獲取類別名稱
    getCategoryName() {
      const category = this.categories.find(
        (category) => category.id === this.project.category
      );
      return category ? `${category.code}: ${category.description}` : "未分類";
    },

    // 獲取設計師名稱
    getDesignerName() {
      return this.project.drawing;
    },

    // 新增計算屬性以檢查編輯權限
    canEditProject() {
      // 檢查 currentUserId 是否有效 (非 null，代表已登入)
      if (typeof currentUserId === 'undefined' || currentUserId === null) {
        return false;
      }

      // 檢查使用者是否為 superuser (全域變數來自 base.html)
      // 'is_superuser' 只在使用者是 superuser 時才會被定義為 true
      if (typeof is_superuser !== 'undefined' && is_superuser) {
        return true;
      }

      // 檢查目前使用者是否為專案負責人之一
      // 確保 project 和 project.managers 已載入且為陣列
      if (this.project && this.project.managers && Array.isArray(this.project.managers)) {
        return this.project.managers.includes(currentUserId);
      }

      return false;
    },

    // 新增計算屬性以檢查是否能查看費用支出
    canViewExpenditure() {
      // 檢查 currentUser 是否已載入
      if (!this.currentUser || !this.currentUser.profile) {
        return false;
      }

      // 只有 admin 或有請款權限的人可以查看費用支出
      return this.currentUser.profile.is_admin || this.currentUser.profile.can_request_payment;
    }
  },
  directives: {
    // 點擊元素外部時觸發的自定義指令
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
    // 從 URL 獲取專案 ID
    getProjectIdFromUrl() {
      const pathParts = window.location.pathname.split("/");
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === "project" && i + 1 < pathParts.length) {
          return parseInt(pathParts[i + 1]);
        }
      }
      return null;
    },

    // 獲取專案詳情
    fetchProjectDetails() {
      fetch(`/crm/api/projects/${this.projectId}/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法獲取專案資料");
          }
          return response.json();
        })
        .then((data) => {
          this.project = data;

          // 更新自定義欄位的值
          if (data.custom_fields) {
            this.customFieldValues = { ...data.custom_fields };
          }

          // 確保 managers 欄位正確更新
          if (data.managers) {
            this.project.managers = data.managers;
            this.project.selected_managers = data.managers_info || [];
          }

          // 初始化自定義欄位值
          if (data.custom_fields) {
            this.customFieldValues = { ...data.custom_fields };
          }

          // 如果有類別ID，獲取該類別的自定義欄位定義
          if (data.category) {
            console.log("Category ID:", data.category);
            this.fetchCategoryCustomFields(data.category);

            this.category_detail = data.category_detail;
          }

          // 初始化選中的專案負責人
          if (data.managers) {
            this.project.managers = data.managers;
            this.project.selected_managers = data.managers_info || [];
          } else {
            this.project.selected_managers = [];
          }

          // 初始化選中的監造人員
          if (data.supervisors) {
            this.project.supervisors = data.supervisors;
            this.project.selected_supervisors = data.supervisors_info || [];
          } else {
            this.project.supervisors = [];
            this.project.selected_supervisors = [];
          }

          // 更新相關搜尋框的內容
          this.updateSearchTerms();
        })
        .catch((error) => {
          console.error("Error fetching project details:", error);
          Swal.fire({
            title: "錯誤!",
            text: "獲取專案資料失敗",
            icon: "error",
            confirmButtonText: "確定",
          });
        });
    },

    // 獲取類別的自定義欄位定義
    fetchCategoryCustomFields(categoryId) {
      fetch(`/crm/api/categories/${categoryId}/custom_fields/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法獲取類別自定義欄位");
          }
          return response.json();
        })
        .then((data) => {
          // 將物件轉換為有序的物件
          const sortedFields = {};

          // 將自定義欄位轉換為陣列並排序
          const sortedEntries = Object.entries(data).sort(([, a], [, b]) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
          });

          // 重新組建排序後的物件
          sortedEntries.forEach(([key, value]) => {
            sortedFields[key] = value;
          });
          this.categoryFields = sortedFields;
          // 初始化欄位值
          Object.keys(data).forEach((fieldName) => {
            if (!(fieldName in this.customFieldValues)) {
              // 根據欄位類型設置默認值
              if (data[fieldName].type === "boolean") {
                this.customFieldValues[fieldName] = false;
              } else if (data[fieldName].type === "number") {
                this.customFieldValues[fieldName] = 0;
              } else {
                this.customFieldValues[fieldName] = "";
              }
            }
          });
        })
        .catch((error) => {
          console.error("Error fetching category custom fields:", error);
        });
    },

    // 獲取業主資料
    fetchOwners() {
      fetch(`/crm/api/owners/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.owners = data.results;
          this.filterOwners();
        })
        .catch((error) => console.error("Error fetching owners:", error));
    },

    // 獲取分類資料
    fetchCategories() {
      fetch(`/crm/api/categories/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.categories = data.results;
        })
        .catch((error) => console.error("Error fetching categories:", error));
    },

    // 獲取使用者資料
    fetchUsers() {
      fetch(`/users/api?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.users = data.results;
          this.projectManagers = this.users.filter(
            (user) => user.profile.is_project_manager
          );

          this.updateSearchTerms()
          this.filterManagers();
          this.filterSupervisors();
        })
        .catch((error) => console.error("Error fetching users:", error));
    },

    // 更新搜尋框的內容
    updateSearchTerms() {
      // 設置業主搜尋框
      if (this.project.owner) {
        const owner = this.owners.find((o) => o.id === this.project.owner);
        if (owner) {
          this.ownerSearchTerm = owner.company_name;
          // 確保 project.owner_name 也被更新
          this.project.owner_name = owner.company_name;
        }
      }

      // 設置專案負責人資料
      if (this.project.managers && this.project.managers.length > 0) {
        this.project.selected_managers = this.users.filter((u) =>
          this.project.managers.includes(u.id)
        );
      }

      // 設置監造人員資料
      if (this.project.supervisors && this.project.supervisors.length > 0) {
        this.project.selected_supervisors = this.users.filter((u) =>
          this.project.supervisors.includes(u.id)
        );
      }
    },

    // 儲存專案資料
    saveProject() {
      // 記錄當前標籤
      const currentTab = this.activeTab;

      // 檢查業主是否存在
      if (
        this.ownerSearchTerm &&
        (!this.project.owner || this.project.owner === "")
      ) {
        // 找不到對應的業主
        const confirmCreate = confirm(
          `找不到名為「${this.ownerSearchTerm}」的業主。\n\n` +
          `- 按「確定」開啟新增業主表單\n` +
          `- 按「取消」繼續儲存但不設置業主`
        );

        if (confirmCreate) {
          // 顯示新增業主表單
          this.showAddOwnerModal();
          return; // 中斷儲存流程
        } else {
          // 繼續儲存但清除業主搜尋詞
          this.ownerSearchTerm = "";
          this.project.owner = "";
        }
      }

      // 只有在專案標記為「已完成」時才驗證自定義欄位
      if (this.project.is_completed) {
        const validationErrors = this.validateCustomFields();
        if (validationErrors.length > 0) {
          Swal.fire({
            title: "欄位驗證錯誤",
            html: "專案標記為「已完成」時,以下必填欄位不能為空：<br>" + validationErrors.join("<br>"),
            icon: "error",
            confirmButtonText: "確定",
          });
          return; // 中斷儲存流程
        }
      }

      // 準備要提交的資料
      const formData = { ...this.project };
      console.log("formData", [...formData["managers"]]);
      // 確保 managers 欄位存在且為陣列
      if (!formData.managers) {
        formData.managers = [];
      } else if (!Array.isArray(formData.managers)) {
        // 如果 managers 不是陣列，確保將其轉換為陣列
        formData.managers = [formData.managers];
      }

      // 確保 supervisors 欄位存在且為陣列
      if (!formData.supervisors) {
        formData.supervisors = [];
      } else if (!Array.isArray(formData.supervisors)) {
        // 如果 supervisors 不是陣列，確保將其轉換為陣列
        formData.supervisors = [formData.supervisors];
      }

      // 移除不需要傳送給 API 的欄位
      delete formData.selected_managers; // 只傳送 ID 列表，不傳送完整物件
      delete formData.manager_info; // 如果存在此欄位也移除
      delete formData.selected_supervisors; // 只傳送 ID 列表，不傳送完整物件
      delete formData.supervisors_info; // 如果存在此欄位也移除

      // 添加自定義欄位值
      formData.custom_fields = this.customFieldValues;

      // 轉換日期格式（如果有日期字段）
      ["invoice_date", "payment_date", "invoice_issue_date"].forEach(
        (field) => {
          if (formData[field] === "") {
            formData[field] = null;
          }
        }
      );

      fetch(`/crm/api/projects/${this.projectId}/`, {
        method: "PATCH",
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
        .then((data) => {
          this.project = data;

          // 更新自定義欄位的值
          if (data.custom_fields) {
            this.customFieldValues = { ...data.custom_fields };
          }

          // 確保 managers 欄位正確更新
          if (data.managers) {
            this.project.managers = data.managers;
            this.project.selected_managers = data.managers_info || [];
          }

          // 儲存成功後清除錯誤提示狀態
          this.showRequiredFieldErrors = false;

          Swal.fire({
            title: "成功!",
            text: "專案資料已更新",
            icon: "success",
            confirmButtonText: "確定",
          });

          // 儲存成功後，確保返回相同標籤頁
          this.$nextTick(() => {
            const tabElement = document.querySelector(
              `a[href="#${currentTab}"]`
            );
            if (tabElement) {
              // 使用 Bootstrap 的 Tab API 切換到之前的標籤頁
              const tab = new bootstrap.Tab(tabElement);
              tab.show();
              this.activeTab = currentTab;
            }
          });
          this.toggleEditMode();
        })
        .catch((error) => {
          console.error("Error saving project:", error);
          Swal.fire({
            title: "失敗!",
            text: `儲存失敗: ${error.message}`,
            icon: "error",
            confirmButtonText: "確定",
          });
        });
    },

    // 刪除專案
    deleteProject() {
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

      // 檢查是否為該專案的經理
      const isProjectManager = this.project && this.project.managers && this.project.managers.includes(currentUserId);

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
          fetch(`/crm/api/projects/${this.projectId}/`, {
            method: "DELETE",
            headers: {
              "X-CSRFToken": document.querySelector(
                'input[name="csrfmiddlewaretoken"]'
              ).value,
            },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error("刪除失敗");
              }
              // 刪除成功後跳轉回專案列表頁面
              window.location.href = "/crm/projects/";
            })
            .catch((error) => {
              console.error("Error deleting project:", error);
              Swal.fire({
                title: "失敗!",
                text: `刪除失敗: ${error.message}`,
                icon: "error",
                confirmButtonText: "確定",
              });
            });
        }
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
      this.project.owner = owner.id;
      this.project.owner_name = owner.company_name; // 同時更新 owner_name
      this.ownerSearchTerm = owner.company_name;
      this.showOwnerDropdown = false;
    },

    closeOwnerDropdown() {
      this.showOwnerDropdown = false;

      // 檢查輸入的業主名稱是否存在於業主清單中
      if (this.ownerSearchTerm) {
        const matchingOwner = this.owners.find(
          (owner) =>
            owner.company_name.toLowerCase() ===
            this.ownerSearchTerm.toLowerCase()
        );

        if (matchingOwner) {
          // 如果找到匹配的業主，直接選擇它
          this.project.owner = matchingOwner.id;
          this.ownerSearchTerm = matchingOwner.company_name; // 確保名稱大小寫與資料庫一致
        } else {
          // 如果沒有匹配的業主，保留搜索詞但清除業主ID
          this.project.owner = "";
        }
      } else {
        // 如果輸入框被清空，則重設業主ID
        this.project.owner = "";
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

    addManager(manager) {
      // 檢查是否已存在
      if (!this.project.managers.includes(manager.id)) {
        this.project.managers.push(manager.id);
        console.log("Managers after add:", [...this.project.managers]);
        this.project.selected_managers.push(manager);
      }
      this.managerSearchTerm = "";
      this.showManagerDropdown = false;
    },

    removeManager(index) {
      const managerId = this.project.selected_managers[index].id;
      this.project.managers.splice(this.project.managers.indexOf(managerId), 1);
      this.project.selected_managers.splice(index, 1);
    },

    closeManagerDropdown() {
      this.showManagerDropdown = false;
    },

    // 監造人員搜尋和選擇
    filterSupervisors() {
      if (!this.supervisorSearchTerm) {
        this.filteredSupervisors = this.projectManagers.slice(0, 10);
        return;
      }

      const searchTerm = this.supervisorSearchTerm.toLowerCase();
      this.filteredSupervisors = this.projectManagers
        .filter(
          (user) =>
            (user.profile.name &&
              user.profile.name.toLowerCase().includes(searchTerm)) ||
            user.username.toLowerCase().includes(searchTerm)
        )
        .slice(0, 10);
    },

    addSupervisor(supervisor) {
      // 檢查是否已存在
      if (!this.project.supervisors.includes(supervisor.id)) {
        this.project.supervisors.push(supervisor.id);
        console.log("Supervisors after add:", [...this.project.supervisors]);
        this.project.selected_supervisors.push(supervisor);
      }
      this.supervisorSearchTerm = "";
      this.showSupervisorDropdown = false;
    },

    removeSupervisor(index) {
      const supervisorId = this.project.selected_supervisors[index].id;
      this.project.supervisors.splice(this.project.supervisors.indexOf(supervisorId), 1);
      this.project.selected_supervisors.splice(index, 1);
    },

    closeSupervisorDropdown() {
      this.showSupervisorDropdown = false;
    },

    // 顯示業主選擇Modal
    showOwnerSelectionModal() {
      // 重置搜尋條件
      this.ownerModalSearchTerm = "";
      this.currentOwnerPage = 1;

      // 顯示Modal
      const modal = new bootstrap.Modal(
        document.getElementById("selectOwnerModal")
      );
      modal.show();

      // modal 顯示後自動focus到搜尋欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.ownerModalSearchInput) {
            this.$refs.ownerModalSearchInput.focus();
          }
        });
      }, { once: true });

      // 載入初始資料
      this.loadOwners();
    },

    // 隱藏業主選擇Modal
    hideOwnerSelectionModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("selectOwnerModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 載入業主資料（支援分頁和搜尋）
    loadOwners(url = null) {
      this.isLoadingOwners = true;

      // 建構 API URL
      let apiUrl = url || "/crm/api/owners/";
      const params = new URLSearchParams();

      if (!url) {
        params.append("page_size", "10");
        params.append("page", this.currentOwnerPage.toString());

        if (this.ownerModalSearchTerm.trim()) {
          params.append("search", this.ownerModalSearchTerm.trim());
        }

        apiUrl += "?" + params.toString();
      }

      fetch(apiUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then((data) => {
          this.modalOwners = data.results || [];
          this.ownerPagination = {
            count: data.count,
            next: data.next,
            previous: data.previous
          };

          // 從URL中提取當前頁碼
          if (data.next || data.previous) {
            const urlObj = new URL(data.next || data.previous, window.location.origin);
            const currentPageFromUrl = urlObj.searchParams.get('page');
            if (data.next) {
              this.currentOwnerPage = parseInt(currentPageFromUrl) - 1;
            } else {
              this.currentOwnerPage = parseInt(currentPageFromUrl) + 1;
            }
          }
        })
        .catch((error) => {
          console.error("Error loading owners:", error);
          Swal.fire({
            title: "錯誤!",
            text: "載入業主資料失敗",
            icon: "error",
            confirmButtonText: "確定",
          });
          this.modalOwners = [];
          this.ownerPagination = null;
        })
        .finally(() => {
          this.isLoadingOwners = false;
        });
    },

    // 搜尋業主（防抖處理）
    searchOwners() {
      // 清除之前的計時器
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      // 設置新的計時器，300ms後執行搜尋
      this.searchTimeout = setTimeout(() => {
        this.currentOwnerPage = 1;
        this.loadOwners();
      }, 300);
    },

    // 從Modal選擇業主
    selectOwnerFromModal(owner) {
      this.project.owner = owner.id;
      this.project.owner_name = owner.company_name; // 同時更新 owner_name
      this.ownerSearchTerm = owner.company_name;
      this.hideOwnerSelectionModal();
    },

    // 前往特定頁面
    goToOwnerPage(page) {
      this.currentOwnerPage = page;
      this.loadOwners();
    },

    // 取得頁碼陣列（用於分頁顯示）
    getOwnerPageNumbers() {
      if (!this.ownerPagination || this.ownerPagination.count === 0) {
        return [];
      }

      const totalPages = Math.ceil(this.ownerPagination.count / 10);
      const currentPage = this.currentOwnerPage;
      const maxVisiblePages = 5;

      if (totalPages <= maxVisiblePages) {
        // 如果總頁數小於等於最大顯示頁數，顯示所有頁面
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
        return pages;
      }

      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      // 調整起始頁，確保顯示的頁面數量正確
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      const pages = [];

      // 添加第一頁和省略號
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
          pages.push('...');
        }
      }

      // 添加中間頁面
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // 添加省略號和最後一頁
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('...');
        }
        pages.push(totalPages);
      }

      return pages;
    },

    // 顯示新增業主Modal
    showAddOwnerModal() {
      // 如果從業主選擇Modal來的，先關閉選擇Modal
      this.hideOwnerSelectionModal();

      // 重置新業主表單
      this.newOwner = {
        company_name: this.ownerModalSearchTerm || "",
        tax_id: "",
        contact_person: "",
        phone: "",
        mobile: "",
        fax: "",
        address: "",
        email: "",
      };

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
          this.project.owner = data.id;
          this.project.owner_name = data.company_name; // 同時更新 owner_name
          this.ownerSearchTerm = data.company_name;

          // 關閉Modal
          this.hideAddOwnerModal();

          // 顯示成功提示
          Swal.fire({
            title: "成功!",
            text: `業主「${data.company_name}」新增成功並已選取`,
            icon: "success",
          });
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            title: "失敗!",
            text: `創建業主失敗：${error.message}`,
            icon: "error",
          });
        });
    },

    // 顯示新增支出Modal
    showAddExpenditureModal() {
      // 重置新支出表單
      this.newExpenditure = {
        date: new Date().toISOString().slice(0, 10), // 預設為今天
        amount: 0,
        description: "",
      };

      // 設置為新增模式
      this.isEditingExpenditure = false;
      this.editingExpenditureId = null;

      // 顯示新增支出Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addExpenditureModal")
      );
      modal.show();
    },

    // 顯示編輯支出Modal
    editExpenditure(expenditure) {
      // 設置為編輯模式
      this.isEditingExpenditure = true;
      this.editingExpenditureId = expenditure.id;

      // 設定表單資料
      this.newExpenditure = {
        date: expenditure.date,
        amount: expenditure.amount,
        description: expenditure.description,
      };

      // 顯示編輯支出Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addExpenditureModal")
      );
      modal.show();
    },

    // 隱藏新增/編輯支出Modal
    hideAddExpenditureModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addExpenditureModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 提交新增或編輯支出表單
    submitExpenditureForm() {
      const expenditureData = {
        project: this.projectId,
        date: this.newExpenditure.date,
        amount: this.newExpenditure.amount,
        description: this.newExpenditure.description,
      };

      // 根據是新增還是編輯選擇不同的API呼叫方式
      let url = "/crm/api/expenditures/";
      let method = "POST";

      if (this.isEditingExpenditure) {
        url = `/crm/api/expenditures/${this.editingExpenditureId}/`;
        method = "PATCH";
      }

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(expenditureData),
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
          // 操作成功後，更新專案詳情以獲取最新支出記錄
          this.fetchProjectDetails();

          // 關閉Modal
          this.hideAddExpenditureModal();

          // 顯示成功提示
          Swal.fire({
            title: "新支出!",
            text: `支出記錄${this.isEditingExpenditure ? "更新" : "新增"}成功`,
            icon: "success",
            confirmButtonText: "確定",
          });
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            title: "錯誤!",
            text: `${this.isEditingExpenditure ? "更新" : "新增"
              }支出記錄失敗：${error.message}`,
            icon: "error",
            confirmButtonText: "確認",
          });
        });
    },

    // 刪除支出記錄
    deleteExpenditure(expenditureId) {
      if (confirm("確定要刪除此支出記錄嗎？此操作無法還原！")) {
        fetch(`/crm/api/expenditures/${expenditureId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              'input[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("刪除失敗");
            }

            // 刪除成功後，更新專案詳情以獲取最新支出記錄
            this.fetchProjectDetails();

            // 顯示成功提示
            Swal.fire({
              title: "刪除!",
              text: "支出記錄已刪除",
              icon: "warning",
              confirmButtonText: "確定",
            });
          })
          .catch((error) => {
            console.error("Error deleting expenditure:", error);
            Swal.fire({
              title: "錯誤!",
              text: `刪除失敗: ${error.message}`,
              icon: "error",
              confirmButtonText: "確定",
            });
          });
      }
    },

    // 顯示新增變更記錄Modal
    showAddChangeModal() {
      // 重置新變更記錄表單
      this.newChange = {
        description: "",
        created_at: new Date().toISOString().slice(0, 10), // 預設為今天
      };
      this.isEditingChange = false;
      this.editingChangeId = null;

      // 顯示新增變更記錄Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addChangeModal")
      );
      modal.show();
    },

    // 顯示編輯變更記錄Modal
    editProjectChange(change) {
      this.isEditingChange = true;
      this.editingChangeId = change.id;

      // 設定表單資料
      this.newChange = {
        description: change.description,
        created_at: change.created_at,
      };

      // 顯示編輯變更記錄Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addChangeModal")
      );
      modal.show();
    },

    // 隱藏新增變更記錄Modal
    hideAddChangeModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addChangeModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 提交新增或編輯變更記錄表單
    submitChangeForm() {
      const changeData = {
        project: this.projectId,
        description: this.newChange.description,
        created_at: this.newChange.created_at,
      };

      // 根據是新增還是編輯選擇不同的API呼叫方式
      let url = "/crm/api/project-changes/";
      let method = "POST";

      if (this.isEditingChange) {
        url = `/crm/api/project-changes/${this.editingChangeId}/`;
        method = "PATCH";
      }

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(changeData),
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
          // 操作成功後，更新專案詳情以獲取最新變更記錄
          this.fetchProjectDetails();

          // 關閉Modal
          this.hideAddChangeModal();

          // 顯示成功提示
          Swal.fire({
            title: "成功!",
            text: `變更記錄${this.isEditingChange ? "更新" : "新增"}成功`,
            icon: "success",
            confirmButtonText: "確定",
          });
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            title: "失敗!",
            text: `${this.isEditingChange ? "更新" : "新增"}變更記錄失敗：${error.message
              }`,
            icon: "error",
            confirmButtonText: "確定",
          });
        });
    },

    // 刪除變更記錄
    deleteProjectChange(changeId) {
      if (confirm("確定要刪除此變更記錄嗎？此操作無法還原！")) {
        fetch(`/crm/api/project-changes/${changeId}/`, {
          method: "DELETE",
          headers: {
            "X-CSRFToken": document.querySelector(
              'input[name="csrfmiddlewaretoken"]'
            ).value,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("刪除失敗");
            }

            // 刪除成功後，更新專案詳情以獲取最新變更記錄
            this.fetchProjectDetails();

            // 顯示成功提示
            Swal.fire({
              title: "已刪除!",
              text: "變更記錄已刪除",
              icon: "warning", // 使用 warning 圖示表示刪除
              confirmButtonText: "確定",
            });
          })
          .catch((error) => {
            console.error("Error deleting project change:", error);
            Swal.fire({
              title: "失敗!",
              text: `刪除失敗: ${error.message}`,
              icon: "error",
              confirmButtonText: "確定",
            });
          });
      }
    },

    // 處理狀態變更
    handleStatusChange(event) {
      const newStatus = event.target.value;

      // 如果切換到已完成,需要驗證必填欄位
      if (newStatus === 'completed' && this.project.status !== 'completed') {
        const validationErrors = this.validateCustomFields();

        if (validationErrors.length > 0) {
          // 阻止切換,恢復原狀態
          event.target.value = this.project.status;
          this.showRequiredFieldErrors = true;

          Swal.fire({
            title: "欄位驗證錯誤",
            html: "專案標記為「已完成」前,以下必填欄位必須填寫：<br>" + validationErrors.join("<br>"),
            icon: "error",
            confirmButtonText: "確定",
          });
          return;
        }
      }

      // 驗證通過,更新狀態
      this.project.status = newStatus;

      // 切換到已完成時顯示紅框提示,其他狀態隱藏
      this.showRequiredFieldErrors = (newStatus === 'completed');
    },

    // 處理「已完成」開關切換 (保留向後相容)
    handleCompletedToggle(event) {
      const newValue = event.target.checked;

      // 如果是從未完成切換到已完成,需要驗證必填欄位
      if (newValue && this.project.status !== 'completed') {
        const validationErrors = this.validateCustomFields();

        if (validationErrors.length > 0) {
          // 阻止切換
          event.target.checked = false;
          this.showRequiredFieldErrors = true;

          Swal.fire({
            title: "欄位驗證錯誤",
            html: "專案標記為「已完成」前,以下必填欄位必須填寫：<br>" + validationErrors.join("<br>"),
            icon: "error",
            confirmButtonText: "確定",
          });
          return;
        }
      }

      // 驗證通過或從已完成切換到未完成,更新狀態
      this.project.status = newValue ? 'completed' : 'in_progress';

      // 切換到已完成時顯示紅框提示,切回未完成時隱藏
      this.showRequiredFieldErrors = newValue;
    },

    // 切換編輯模式
    toggleEditMode() {
      if (this.isEditMode) {
        // 從編輯模式切換到查看模式，重新載入資料
        this.fetchProjectDetails();
        this.showRequiredFieldErrors = false;
      }
      this.isEditMode = !this.isEditMode;
    },

    // 切換標籤頁
    switchTab(tabId) {
      this.activeTab = tabId;
      // Bootstrap 已經處理了標籤切換的顯示邏輯，此方法僅用於記錄當前活動標籤
    },

    // 驗證自定義欄位
    validateCustomFields() {
      const errors = [];

      // 檢查每個自定義欄位
      Object.entries(this.categoryFields).forEach(([fieldName, field]) => {
        if (field.required) {
          const value = this.customFieldValues[fieldName];

          // 根據欄位類型進行驗證
          if (field.type === 'boolean') {
            // boolean 類型不需要驗證，因為總是有值（true 或 false）
            return;
          } else if (field.type === 'number') {
            // 數字類型：檢查是否為 null、undefined 或空字串
            if (value === null || value === undefined || value === '') {
              errors.push(`• ${field.display_name}`);
            }
          } else {
            // 其他類型（text, textarea, date）：檢查是否為空字串或只包含空白字元
            if (!value || (typeof value === 'string' && value.trim() === '')) {
              errors.push(`• ${field.display_name}`);
            }
          }
        }
      });

      return errors;
    },

    // 格式化金額顯示
    formatAmount(amount) {
      return parseFloat(amount).toLocaleString("zh-TW", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },

    // 取得付款方式顯示文字
    getPaymentMethodDisplay(method) {
      const methods = {
        'cash': '現金',
        'bank_transfer': '銀行轉帳',
        'check': '支票',
        'credit_card': '信用卡',
        'other': '其他'
      };
      return methods[method] || method || '未設定';
    },

    // 取得發票狀態顯示文字
    getInvoiceStatusDisplay(status) {
      const statuses = {
        'paid': '已付款',
        'unpaid': '未付款',
        'partially_paid': '付款未完成'
      };
      return statuses[status] || '未設定';
    },

    // 取得發票狀態樣式類別
    getInvoiceStatusBadgeClass(status) {
      const classes = {
        'paid': 'badge-success',
        'unpaid': 'badge-danger',
        'partially_paid': 'badge-warning'
      };
      return classes[status] || 'badge-light-secondary';
    },

    // 取得收款狀態顯示文字
    getPaymentStatusDisplay(status) {
      const mapping = {
        'over': '請款超收',
        'full': '全額收款',
        'partial': '部分收款',
        'none': '未收款',
        'no_judgment': '不判斷'
      };
      return mapping[status] || '未設定';
    },

    // 取得收款狀態 badge 樣式
    getPaymentStatusBadgeClass(status) {
      const mapping = {
        'over': 'badge-warning',
        'full': 'badge-success',
        'partial': 'badge-warning',
        'none': 'badge-danger'
      };
      return mapping[status] || 'badge-light-secondary';
    },

    // 計算專案總支出
    getTotalProjectReceived() {
      if (!this.project.related_payments) return 0;
      return this.project.related_payments.reduce((total, payment) => {
        return total + (payment.total_received || 0);
      }, 0);
    }
  },
  mounted() {
    this.projectId = this.getProjectIdFromUrl();

    if (!this.projectId) {
      Swal.fire({
        title: "錯誤!",
        text: "無效的專案 ID",
        icon: "error",
        confirmButtonText: "確定",
      }).then(() => {
        // 在用戶點擊確定後才跳轉
        window.location.href = "/crm/projects/";
      });
      return;
    }

    // 獲取所有需要的數據
    this.fetchOwners();
    this.fetchCategories();
    this.fetchUsers();
    this.fetchProjectDetails();
    this.currentUser = window.CURRENT_USER_DATA || {};

    // 監聴標籤頁切換事件
    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach((tab) => {
      tab.addEventListener("shown.bs.tab", (event) => {
        // 從 href 中獲取標籤頁 ID
        const targetId = event.target.getAttribute("href").substring(1);
        this.activeTab = targetId;
      });
    });
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
