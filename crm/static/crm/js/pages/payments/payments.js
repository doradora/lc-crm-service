const paymentList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      payments: [],
      projects: [], // 所有專案（保留給付款單顯示用）
      isLoading: false,
      searchQuery: "",
      paidFilter: "", // 付款狀態過濾
      projectFilter: "", // 專案過濾（實際選到的專案id）
      projectSearchText: "", // 專案搜尋框顯示文字
      // 專案選擇模態視窗相關
      projectModalSearchTerm: "",
      modalProjects: [],
      isLoadingProjects: false,
      projectPagination: null,
      currentProjectPage: 1,
      searchProjectTimeout: null,
      // 模態框篩選條件
      modalOwnerFilter: "",
      modalCategoryFilter: "",
      modalStartYearFilter: "",
      modalEndYearFilter: "",
      modalCompletedFilter: "",
      // 資料來源
      owners: [],
      categories: [],
      availableYears: [],
      minYear: null,
      maxYear: null,
      activeMenu: null,
      currentPage: 1,
      totalPages: 1,
      pageSize: 10, // 每頁顯示的項目數，可調整
      menuPosition: {
        x: 0,
        y: 0,
      },
      projectMap: {}, // 專案 ID 到專案名稱的映射
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

    // 業主和類別映射
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
  },
  methods: {
    // 獲取付款列表
    fetchPayments(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/payments/?format=json&page=${page}&page_size=${this.pageSize}`;

      // 添加搜尋條件
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      // 添加付款狀態過濾
      if (this.paidFilter === "paid") {
        url += `&paid=true`;
      } else if (this.paidFilter === "unpaid") {
        url += `&paid=false`;
      }

      // 添加專案過濾
      if (this.projectFilter) {
        url += `&project=${this.projectFilter}`;
      }

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.payments = data.results;
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching payments:", error))
        .finally(() => {
          this.isLoading = false;
        });
    },

    // 獲取付款單的專案名稱
    getProjectNames(payment) {
      if (!payment.payment_projects || payment.payment_projects.length === 0) {
        return "無關聯專案";
      }

      const projectNames = payment.payment_projects
        .map(
          (pp) => pp.project_name || this.projectMap[pp.project] || "未知專案"
        )
        .filter(Boolean);

      return projectNames.join(", ");
    },

    // 計算請款單的關聯發票實收金額總和
    getInvoiceActualReceivedAmount(payment) {
      if (!payment.invoices || payment.invoices.length === 0) {
        return 0;
      }
      return payment.invoices.reduce((total, invoice) => {
        return total + Number(invoice.actual_received_amount || 0);
      }, 0);
    },

    // 格式化日期
    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    },

    // 格式化貨幣
    formatCurrency(value) {
      if (value === null || value === undefined) return "-";
      return new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
        minimumFractionDigits: 0,
      }).format(value);
    },

    // 獲取狀態標籤樣式類
    getStatusBadgeClass(payment) {
      return payment.paid ? "badge-light-success" : "badge-light-warning";
    },

    // 查看付款單詳情
    viewPaymentDetails(paymentId) {
      window.location.href = `/crm/payment/${paymentId}/details/`;
    },

    // 刪除付款單
    deletePayment(paymentId) {
      if (confirm("確定要刪除此請款單嗎？此操作無法還原！")) {
        fetch(`/crm/api/payments/${paymentId}/`, {
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
            this.fetchPayments(this.currentPage); // 重新獲取當前頁數據
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
      }
    },

    // 切換付款狀態
    togglePaidStatus(payment) {
      const updatedData = {
        paid: !payment.paid,
      };

      // 如果標記為已付款，添加付款日期
      if (!payment.paid) {
        updatedData.payment_date = new Date().toISOString().split("T")[0];
      } else {
        updatedData.payment_date = null;
      }

      fetch(`/crm/api/payments/${payment.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]')
            .value,
        },
        body: JSON.stringify(updatedData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("更新狀態失敗");
          }
          return response.json();
        })
        .then((data) => {
          // 更新本地數據
          const index = this.payments.findIndex((p) => p.id === payment.id);
          if (index !== -1) {
            this.payments[index].paid = data.paid;
            this.payments[index].payment_date = data.payment_date;
          }
          this.activeMenu = null;
        })
        .catch((error) => console.error("無法更新狀態:", error));
    },

    // 切換下拉選單
    toggleMenu(paymentId) {
      if (this.activeMenu === paymentId) {
        this.activeMenu = null;
      } else {
        // 計算位置
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120, // 向左偏移 120px
          y: rect.bottom + 10, // 向下偏移 10px
        };
        this.activeMenu = paymentId;
      }
      event.stopPropagation();
    },

    // 獲取下拉選單的樣式
    getMenuStyle(paymentId) {
      if (this.activeMenu !== paymentId) {
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

    // 處理點擊外部關閉下拉選單
    handleClickOutside(event) {
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

    // 搜尋專案（防抖處理，用於模態視窗）
    searchProjects() {
      // 清除之前的計時器
      if (this.searchProjectTimeout) {
        clearTimeout(this.searchProjectTimeout);
      }
      
      // 設置新的計時器，300ms後執行搜尋
      this.searchProjectTimeout = setTimeout(() => {
        this.currentProjectPage = 1;
        this.loadProjects();
      }, 300);
    },

    // 從模態視窗選擇專案
    selectProjectFromModal(project) {
      this.projectFilter = project.id;
      this.projectSearchText = `${project.year}${project.category_code || 'N'}${project.project_number} - ${project.name}`;
      this.hideProjectSelectionModal();
    },

    // 清除專案選擇
    clearProjectSelection() {
      this.projectFilter = '';
      this.projectSearchText = '';
    },

    // 顯示專案選擇Modal
    showProjectSelectionModal() {
      // 重置搜尋條件
      this.projectModalSearchTerm = "";
      this.currentProjectPage = 1;
      
      // 顯示Modal
      const modal = new bootstrap.Modal(
        document.getElementById("selectProjectModal")
      );
      modal.show();
      
      // modal 顯示後自動focus到搜尋欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.projectModalSearchInput) {
            this.$refs.projectModalSearchInput.focus();
          }
        });
      }, { once: true });
      
      // 載入初始資料
      this.loadProjects();
    },

    // 重置模態框篩選條件
    resetModalFilters() {
      this.modalOwnerFilter = "";
      this.modalCategoryFilter = "";
      this.modalStartYearFilter = "";
      this.modalEndYearFilter = "";
      this.modalCompletedFilter = "";
      this.projectModalSearchTerm = "";
      this.currentProjectPage = 1;
      this.loadProjects();
    },

    // 隱藏專案選擇Modal
    hideProjectSelectionModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("selectProjectModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 載入專案資料（支援分頁和搜尋）
    loadProjects(url = null) {
      this.isLoadingProjects = true;
      
      // 建構 API URL
      let apiUrl = url || "/crm/api/projects/";
      const params = new URLSearchParams();
      
      if (!url) {
        params.append("format", "json");
        params.append("page_size", "10");
        params.append("page", this.currentProjectPage.toString());
        
        if (this.projectModalSearchTerm.trim()) {
          params.append("search", this.projectModalSearchTerm.trim());
        }

        // 添加篩選條件
        if (this.modalOwnerFilter) {
          params.append("owner", this.modalOwnerFilter);
        }

        if (this.modalCategoryFilter) {
          params.append("category", this.modalCategoryFilter);
        }

        if (this.modalCompletedFilter === "completed") {
          params.append("is_completed", "true");
        } else if (this.modalCompletedFilter === "incomplete") {
          params.append("is_completed", "false");
        }

        // 使用年份區間過濾
        if (this.modalStartYearFilter) {
          params.append("year_start", this.modalStartYearFilter);
        }

        if (this.modalEndYearFilter) {
          params.append("year_end", this.modalEndYearFilter);
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
          this.modalProjects = data.results ? data.results.map(project => {
            // 處理專案類別代碼
            if (project.category_detail && project.category_detail.code) {
              project.category_code = project.category_detail.code;
              project.category_name = `${project.category_detail.code}: ${project.category_detail.description}`;
            } else {
              project.category_code = 'N';
              project.category_name = '未分類';
            }
            return project;
          }) : [];
          
          this.projectPagination = {
            count: data.count,
            next: data.next,
            previous: data.previous,
          };
          
          // 更新當前頁面
          if (url) {
            const urlObj = new URL(url);
            const pageParam = urlObj.searchParams.get("page");
            if (pageParam) {
              this.currentProjectPage = parseInt(pageParam);
            }
          }
        })
        .catch((error) => {
          console.error("載入專案資料時發生錯誤:", error);
          this.modalProjects = [];
          this.projectPagination = null;
        })
        .finally(() => {
          this.isLoadingProjects = false;
        });
    },

    // 前往特定頁面
    goToProjectPage(page) {
      this.currentProjectPage = page;
      this.loadProjects();
    },

    // 取得頁碼陣列（用於分頁顯示）
    getProjectPageNumbers() {
      if (!this.projectPagination || this.projectPagination.count === 0) {
        return [];
      }
      
      const totalPages = Math.ceil(this.projectPagination.count / 10);
      const currentPage = this.currentProjectPage;
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

    // 處理每頁數量變更
    pageSizeChanged() {
      this.currentPage = 1; // 更改每頁數量時重置為第一頁
      this.fetchPayments(1);
    },

    // 新建請款單
    createNewPayment() {
      window.location.href = "/crm/create_payment/";
    },

    // 獲取業主列表
    fetchOwners() {
      fetch(`/crm/api/owners/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.owners = data.results || [];
        })
        .catch((error) => console.error("Error fetching owners:", error));
    },

    // 獲取類別列表
    fetchCategories() {
      fetch(`/crm/api/categories/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.categories = data.results || [];
        })
        .catch((error) => console.error("Error fetching categories:", error));
    },

    // 獲取可用年份
    fetchYears() {
      fetch(`/crm/api/projects/years/`)
        .then((response) => response.json())
        .then((data) => {
          this.availableYears = data.years || [];
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
  },
  mounted() {
    // 檢查URL參數中的專案篩選
    const urlParams = new URLSearchParams(window.location.search);
    const projectParam = urlParams.get('project');
    if (projectParam) {
      this.projectFilter = projectParam;
      fetch(`/crm/api/projects/${projectParam}/?format=json`)
        .then(res => res.json())
        .then(data => {
          // 設置專案顯示文字
          const categoryCode = data.category_detail ? data.category_detail.code : 'N';
          this.projectSearchText = `${data.year}${categoryCode}${data.project_number} - ${data.name}`;
        });
    }
    
    // 載入基本資料
    this.fetchPayments();
    this.fetchOwners();
    this.fetchCategories();
    this.fetchYears();
    
    // 頁面載入後自動focus到搜尋欄位
    this.$nextTick(() => {
      if (this.$refs.searchInput) {
        this.$refs.searchInput.focus();
      }
    });
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.querySelectorAll("[v-click-outside]").forEach((el) => {
      if (el._clickOutside) {
        document.removeEventListener("click", el._clickOutside);
      }
    });
  },
}).mount("#app_main");
