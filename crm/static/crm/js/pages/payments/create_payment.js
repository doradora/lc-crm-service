const paymentsList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      projects: [],
      owners: [],
      companys: [],
      categories: [],
      users: [],
      isLoading: false,
      searchQuery: "",
      ownerFilter: "",
      ownerSearchText: "", // 業主搜尋文字
      filteredOwners: [], // 過濾後的業主列表
      showOwnerDropdown: false, // 是否顯示業主下拉選單
      selectedOwnerName: "", // 已選擇的業主名稱
      companyFilter: "", // 新增：收款公司 ID
      companySearchText: "", // 新增：收款公司搜尋文字
      filteredCompanys: [], // 新增：過濾後的收款公司列表
      showCompanyDropdown: false, // 新增：是否顯示收款公司下拉選單
      categoryFilter: "", // 類別篩選 (保留)
      startYearFilter: "", // 開始年份
      endYearFilter: "", // 結束年份
      isCompletedFilter: true, // 新增：是否完成篩選
      isUninvoicedFilter: true, // 新增：是否請款篩選
      isPaidFilter: false, // 新增：是否收款篩選
      selectedProjects: new Map(), // 使用 Map 儲存已選擇的專案
      availableYears: [], // 資料庫中現有的年份
      minYear: null, // 最小年份
      maxYear: null, // 最大年份
      projectAmounts: {}, // 專案金額 (在 Modal 中使用)
      projectDescriptions: {}, // 專案描述
      newPayment: {
        payment_number: "",
        date_issued: new Date().toISOString().split("T")[0], // 今天的日期
        due_date: "", // 付款截止日期
        notes: "", // 備註
      },
      selectAllChecked: false, // 全選狀態
      paymentItems: [], // 新增：付款項目陣列初始化
      projectNameFilter: '', // 新增：專案名稱前端過濾
      // 業主選擇模態視窗相關
      ownerModalSearchTerm: "",
      modalOwners: [],
      isLoadingOwners: false,
      ownerPagination: null,
      currentOwnerPage: 1,
      searchTimeout: null,
      // 新增業主表單
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
      // 選中的銀行帳戶
      selectedBankAccount: null,
      // 防止重複調用API的標誌
      isLoadingBankAccounts: false,
      lastSelectedCompanyId: null,
      // 公司搜尋防抖計時器
      companySearchTimeout: null,
    };
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
  computed: {
    // 將 Map 轉換為陣列以便在模板中使用
    selectedProjectsList() {
      return Array.from(this.selectedProjects.values());
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
    filteredProjects() {
      if (!this.projectNameFilter.trim()) {
        return this.projects;
      }
      const keyword = this.projectNameFilter.trim().toLowerCase();
      return this.projects.filter(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(keyword);
        // 搜尋負責人
        let managerMatch = false;
        if (Array.isArray(p.managers_info)) {
          managerMatch = p.managers_info.some(mgr =>
            mgr.name && mgr.name.toLowerCase().includes(keyword)
          );
        }
        return nameMatch || managerMatch;
      });
    },
  },
  methods: {
    // 搜尋業主（防抖處理，用於模態視窗）
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

    // 從模態視窗選擇業主
    selectOwnerFromModal(owner) {
      this.ownerFilter = owner.id;
      this.ownerSearchText = owner.company_name;
      this.hideOwnerSelectionModal();
    },

    // 選擇業主（保留舊方法作為備用）
    selectOwner(owner) {
      this.ownerFilter = owner.id;
      this.ownerSearchText = owner.company_name;
      this.showOwnerDropdown = false;
    },

    // 清除業主選擇
    clearOwnerSelection() {
      this.ownerFilter = "";
      this.ownerSearchText = "";
      this.filteredOwners = [];
      this.showOwnerDropdown = false;
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
        params.append("format", "json");
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
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          this.modalOwners = data.results || [];
          this.ownerPagination = {
            count: data.count,
            next: data.next,
            previous: data.previous,
          };
          
          // 更新當前頁面
          if (url) {
            const urlObj = new URL(url);
            const pageParam = urlObj.searchParams.get("page");
            if (pageParam) {
              this.currentOwnerPage = parseInt(pageParam);
            }
          }
        })
        .catch((error) => {
          console.error("載入業主資料時發生錯誤:", error);
          this.modalOwners = [];
          this.ownerPagination = null;
        })
        .finally(() => {
          this.isLoadingOwners = false;
        });
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
      const pages = [];
      
      // 如果總頁數 <= 7，顯示所有頁碼
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // 總頁數 > 7，使用省略號邏輯
        if (currentPage <= 4) {
          // 當前頁在前面
          for (let i = 1; i <= 5; i++) {
            pages.push(i);
          }
          pages.push("...");
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 3) {
          // 當前頁在後面
          pages.push(1);
          pages.push("...");
          for (let i = totalPages - 4; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          // 當前頁在中間
          pages.push(1);
          pages.push("...");
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push("...");
          pages.push(totalPages);
        }
      }
      
      return pages;
    },

    // 顯示新增業主Modal
    showAddOwnerModal() {
      // 如果從搜尋業主時點擊新增，則預填公司名稱
      if (this.ownerModalSearchTerm) {
        this.newOwner.company_name = this.ownerModalSearchTerm;
      } else {
        // 重置新業主表單
        this.newOwner = {
          company_name: "",
          tax_id: "",
          contact_person: "",
          phone: "",
          mobile: "",
          fax: "",
          address: "",
          email: "",
        };
      }

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
          // 新增業主成功後，選擇新增的業主
          this.selectOwnerFromModal(data);

          // 關閉Modal
          this.hideAddOwnerModal();

          // 顯示成功提示
          Swal.fire({
            title: "成功!",
            text: `業主「${data.company_name}」新增成功`,
            icon: "success",
            confirmButtonText: "確定",
          });
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            title: "錯誤!",
            text: `創建業主失敗：${error.message}`,
            icon: "error",
            confirmButtonText: "確定",
          });
        });
    },

    // 關閉業主下拉選單
    closeOwnerDropdown() {
      this.showOwnerDropdown = false;

      // 檢查輸入的業主名稱是否存在於業主清單中
      if (this.ownerSearchText) {
        const matchingOwner = this.owners.find(
          (owner) =>
            owner.company_name.toLowerCase() ===
            this.ownerSearchText.toLowerCase()
        );

        if (matchingOwner) {
          // 如果找到匹配的業主，直接選擇它
          this.ownerFilter = matchingOwner.id;
          this.ownerSearchText = matchingOwner.company_name; // 確保名稱大小寫與資料庫一致
        } else {
          // 如果沒有匹配的業主，保留搜索詞但清除業主ID
          this.ownerFilter = "";
        }
      } else {
        // 如果輸入框被清空，則重設業主ID
        this.ownerFilter = "";
      }
    },

    // 搜尋收款公司
    searchCompanys() {
      // 清除之前的計時器
      if (this.companySearchTimeout) {
        clearTimeout(this.companySearchTimeout);
      }
      
      // 設置新的計時器，300ms後執行搜尋
      this.companySearchTimeout = setTimeout(() => {
        if (!this.companySearchText.trim()) {
          this.filteredCompanys = this.companys.slice(0, 10); // 顯示前10個
          return;
        }

        const searchText = this.companySearchText.toLowerCase().trim();
        this.filteredCompanys = this.companys
          .filter(
            (company) =>
              company.name.toLowerCase().includes(searchText) ||
              (company.tax_id && company.tax_id.includes(searchText))
          )
          .slice(0, 10); // 最多顯示10個結果

        this.showCompanyDropdown = true;
      }, 300);
    },

    // 選擇收款公司
    selectCompany(company) {
      this.companyFilter = company.id;
      this.companySearchText = company.name;
      this.showCompanyDropdown = false;
      
      // 只有當選擇的公司不同時才獲取銀行帳戶資訊
      if (this.lastSelectedCompanyId !== company.id) {
        this.fetchCompanyBankAccounts(company.id);
        this.lastSelectedCompanyId = company.id;
      }
    },
    
    // 獲取公司的銀行帳戶資訊
    fetchCompanyBankAccounts(companyId) {
      // 防止重複調用
      if (this.isLoadingBankAccounts) {
        return;
      }
      
      this.isLoadingBankAccounts = true;
      
      fetch(`/crm/api/companys/${companyId}/`)
        .then(response => response.json())
        .then(data => {
          if (data.first_bank_account) {
            this.selectedBankAccount = data.first_bank_account;
            console.log('自動選擇第一個銀行帳戶:', this.selectedBankAccount);
          } else {
            this.selectedBankAccount = null;
            console.log('該公司沒有銀行帳戶');
          }
        })
        .catch(error => {
          console.error('獲取銀行帳戶失敗:', error);
          this.selectedBankAccount = null;
        })
        .finally(() => {
          this.isLoadingBankAccounts = false;
        });
    },

    // 清除收款公司選擇
    clearCompanySelection() {
      this.companyFilter = "";
      this.companySearchText = "";
      this.filteredCompanys = [];
      this.showCompanyDropdown = false;
      this.selectedBankAccount = null; // 清除選中的銀行帳戶
      this.lastSelectedCompanyId = null; // 重置最後選擇的公司ID
    },

    // 關閉收款公司下拉選單
    closeCompanyDropdown() {
      this.showCompanyDropdown = false;

      // 檢查輸入的收款公司名稱是否存在於公司清單中
      if (this.companySearchText) {
        const matchingCompany = this.companys.find(
          (company) =>
            company.name.toLowerCase() ===
            this.companySearchText.toLowerCase()
        );

        if (matchingCompany) {
          // 如果找到匹配的公司，直接選擇它
          this.companyFilter = matchingCompany.id;
          this.companySearchText = matchingCompany.name; // 確保名稱大小寫與資料庫一致
          // 只有當選擇的公司不同時才獲取銀行帳戶資訊
          if (this.lastSelectedCompanyId !== matchingCompany.id) {
            this.fetchCompanyBankAccounts(matchingCompany.id);
            this.lastSelectedCompanyId = matchingCompany.id;
          }
        } else {
          // 如果沒有匹配的公司，保留搜索詞但清除公司ID
          this.companyFilter = "";
          this.selectedBankAccount = null;
          this.lastSelectedCompanyId = null;
        }
      } else {
        // 如果輸入框被清空，則重設公司ID
        this.companyFilter = "";
        this.selectedBankAccount = null;
        this.lastSelectedCompanyId = null;
      }
    },

    // 獲取收款公司列表
    fetchCompanys() {
      fetch(`/crm/api/companys/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          if (data && data.results) {
            this.companys = data.results;
            this.filteredCompanys = this.companys.slice(0, 10); // 初始顯示前10個
          } else {
            this.companys = [];
            this.filteredCompanys = [];
          }
        })
        .catch((error) => {
          console.error("Error fetching companys:", error);
          this.companys = [];
          this.filteredCompanys = [];
        });
    },

    // 修改: 選擇類別 (簡化為直接使用下拉選單的值)
    selectCategory(categoryId) {
      this.categoryFilter = categoryId;
    },

    // 修改: 清除類別選擇
    clearCategorySelection() {
      this.categoryFilter = "";
    },

    // 重設篩選條件 (修改)
    resetFilters() {
      this.searchQuery = "";
      this.ownerFilter = "";
      this.ownerSearchText = "";
      this.selectedOwnerName = "";
      this.categoryFilter = ""; // 保留: 重設類別篩選
      this.startYearFilter = "";
      this.endYearFilter = "";
      // 重設核取方塊
      this.isCompletedFilter = true;
      this.isUninvoicedFilter = true;
      this.isPaidFilter = false;
    },
    // 切換專案選擇狀態
    toggleProjectSelection(project) {
      if (this.selectedProjects.has(project.id)) {
        this.selectedProjects.delete(project.id);
      } else {
        this.selectedProjects.set(project.id, project);

        // 如果是新選的專案且還沒有設置金額，設置預設金額
        if (!this.projectAmounts[project.id]) {
          this.projectAmounts[project.id] = 0;
        }
      }

      // 更新全選狀態
      this.updateSelectAllState();
    },
    // 檢查專案是否被選取
    isProjectSelected(projectId) {
      return this.selectedProjects.has(projectId);
    },
    // 全選/取消全選
    selectAllProjects() {
      this.selectAllChecked = !this.selectAllChecked;

      if (this.selectAllChecked) {
        // 全選所有專案
        this.projects.forEach((project) => {
          this.selectedProjects.set(project.id, project);

          // 確保每個專案都有預設金額
          if (!this.projectAmounts[project.id]) {
            this.projectAmounts[project.id] = 0;
          }
        });
      } else {
        // 取消全選
        this.projects.forEach((project) => {
          this.selectedProjects.delete(project.id);
        });
      }
    },
    // 更新全選狀態
    updateSelectAllState() {
      if (this.projects.length > 0) {
        this.selectAllChecked = this.projects.every((project) =>
          this.selectedProjects.has(project.id)
        );
      } else {
        this.selectAllChecked = false;
      }
    },
    // 獲取專案列表 (更新以處理新增的篩選條件)
    fetchProjects() {
      this.isLoading = true;
      // 移除分頁參數，增加載入數量限制為1000
      let url = `/crm/api/projects/?format=json&page_size=1000`;

      // 添加搜尋條件
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      // 添加業主過濾條件
      if (this.ownerFilter) {
        url += `&owner=${this.ownerFilter}`;
      } else {
        // 如果沒有選擇業主，顯示警告並停止獲取專案
        Swal.fire({
          icon: "warning",
          title: "請先選擇業主",
        });
        this.isLoading = false;
        return;
      }

      // 新增：添加類別過濾條件
      if (this.categoryFilter) {
        url += `&category=${this.categoryFilter}`;
      }

      // 使用年份區間過濾
      if (this.startYearFilter) {
        url += `&year_start=${this.startYearFilter}`;
      }

      if (this.endYearFilter) {
        url += `&year_end=${this.endYearFilter}`;
      }

      // 修改：使用獨立的核取方塊來篩選
      if (this.isCompletedFilter) {
        url += `&is_completed=true`;
      }

      if (this.isUninvoicedFilter) {
        url += `&is_invoiced=false`;
      }

      if (this.isPaidFilter) {
        url += `&is_paid=true`;
      }

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // 確保 data.results 存在
          if (data && data.results) {
            this.projects = data.results.map((project) => {
              // 正確處理類別代碼 這裡不對
              if (project.category) {
                if (
                  typeof project.category === "object" &&
                  project.category.code
                ) {
                  // 如果 category 是包含 code 屬性的對象
                  project.category_code = project.category.code;
                } else if (project.category_name) {
                  // 如果有 category_name，從中提取代碼
                  const match = project.category_name.match(/^([^:]+):/);
                  project.category_code = match ? match[1].trim() : "";
                }
              } else {
                project.category_code = "";
              }
              return project;
            });
          } else {
            this.projects = []; // 確保即使 data.results 不存在也會初始化陣列
          }

          // 更新全選狀態
          this.updateSelectAllState();
        })
        .catch((error) => {
          // 如果沒有選擇業主，顯示警告並停止獲取專案
          Swal.fire({
            icon: "warning",
            title: "獲取專案錯誤，聯絡工程師",
          });
          this.isLoading = false;
          console.error("Error fetching projects:", error);
          this.projects = []; // 錯誤處理時也初始化陣列
        })
        .finally(() => {
          this.isLoading = false;
        });
    },
    // 獲取業主列表時，確保有顯示前10筆
    fetchOwners() {
      fetch(`/crm/api/owners/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          if (data && data.results) {
            this.owners = data.results;
            this.filteredOwners = this.owners.slice(0, 10); // 初始顯示前10個
          } else {
            this.owners = [];
            this.filteredOwners = [];
          }
        })
        .catch((error) => {
          console.error("Error fetching owners:", error);
          this.owners = [];
          this.filteredOwners = [];
        });
    },
    fetchCategories() {
      fetch(`/crm/api/categories/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.categories = data && data.results ? data.results : [];
        })
        .catch((error) => {
          console.error("Error fetching categories:", error);
          this.categories = [];
        });
    },
    // 獲取用戶列表
    fetchUsers() {
      fetch(`/users/api?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.users = data && data.results ? data.results : [];
        })
        .catch((error) => {
          console.error("Error fetching users:", error);
          this.users = [];
        });
    },
    // 獲取可用年份
    fetchYears() {
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
    // 顯示新增請款單 Modal
    showAddPaymentModal() {
      if (this.selectedProjects.size === 0) {
        return;
      }

      // 設置今天日期為預設發行日期
      this.newPayment.date_issued = new Date().toISOString().split("T")[0];

      // 生成預設請款單號
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");

      this.newPayment.payment_number = `P${year}${month}${day}-${random}`;

      // 顯示 Modal
      const modal = new bootstrap.Modal(
        document.getElementById("addPaymentModal")
      );
      modal.show();
    },
    // 隱藏新增請款單 Modal
    hideAddPaymentModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addPaymentModal")
      );
      if (modal) {
        modal.hide();
      }
    },
    // 提交請款單表單
    submitPaymentForm() {
      // 表單驗證
      const selectedProjectIds = Array.from(this.selectedProjects.keys());
      if (selectedProjectIds.length === 0) {
        Swal.fire({
          title: "驗證失敗!",
          text: "請選擇至少一個專案",
          icon: "warning",
          confirmButtonText: "確定",
        });
        return;
      }

      if (!this.ownerFilter) {
        Swal.fire({
          title: "驗證失敗!",
          text: "請先選擇業主",
          icon: "warning",
          confirmButtonText: "確定",
        });
        return;
      }

      if (!this.companyFilter) {
        Swal.fire({
          title: "驗證失敗!",
          text: "請選擇收款公司",
          icon: "warning",
          confirmButtonText: "確定",
        });
        return;
      }

      // 準備請款單資料
      const paymentData = {
        payment_number: this.newPayment.payment_number,
        date_issued: this.newPayment.date_issued,
        payment_projects: selectedProjectIds.map((projectId) => ({
          project: projectId,
          amount: this.projectAmounts[projectId],
        })),
        owner: this.ownerFilter,
        company: this.companyFilter, // 新增：收款公司
      };

      // 送出API請求創建請款單
      fetch("/crm/api/payments/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            "input[name='csrfmiddlewaretoken']"
          ).value,
        },
        body: JSON.stringify(paymentData),
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
          this.hideAddPaymentModal(); // 關閉 Modal

          // 重設選擇的專案
          this.selectedProjects.clear();
          this.projectAmounts = {};
          this.projectDescriptions = {};

          // 更新全選狀態
          this.updateSelectAllState();

          // 顯示成功提示
          // alert(
          //   `請款單 ${data.payment_number} 已成功建立，請在詳情頁完善其他資訊`
          // );

          // 導航到請款單詳情頁面
          window.location.href = `/crm/payment/${data.id}/details/`;
        })
        .catch((error) => {
          console.error("建立請款單失敗:", error);
          alert("建立請款單失敗，請檢查資料後重試");
        });
    },
  },
  mounted() {
    // 載入資料
    this.fetchOwners();
    this.fetchCategories();
    this.fetchUsers();
    this.fetchYears();
    this.fetchCompanys(); // 新增：載入收款公司列表
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.querySelectorAll("[v-click-outside]").forEach((el) => {
      if (el._clickOutside) {
        document.removeEventListener("click", el._clickOutside);
      }
    });
    
    // 清理計時器
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.companySearchTimeout) {
      clearTimeout(this.companySearchTimeout);
    }
  },
}).mount("#app_main");
