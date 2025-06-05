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
      projectSearch: "", // 專案搜尋框內容
      projectSuggestions: [], // 專案搜尋建議清單
      showProjectSuggestions: false, // 是否顯示建議清單
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
      // 新增：隱藏專案建議清單
      if (this.showProjectSuggestions) {
        const input = document.querySelector('input[v-model="projectSearch"]');
        const ul = document.querySelector('.list-group.position-absolute');
        if (
          (!input || !input.contains(event.target)) &&
          (!ul || !ul.contains(event.target))
        ) {
          this.showProjectSuggestions = false;
        }
      }
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

    // 動態搜尋專案
    onProjectSearch() {
      const keyword = this.projectSearch.trim();
      // 如果keyword沒變，則直接return
      if (this._lastProjectSearchKeyword === keyword) {
        return;
      }
      this._lastProjectSearchKeyword = keyword;

      this._projectSearchToken = (this._projectSearchToken || 0) + 1;
      const currentToken = this._projectSearchToken;
      if (!keyword) {
        fetch('/crm/api/projects/?format=json&ordering=-id&page_size=10')
          .then(res => res.json())
          .then(data => {
            if (this._projectSearchToken !== currentToken) return; // 只處理最新請求
            this.projectSuggestions = data.results;
            this.showProjectSuggestions = true;
          });
      } else {
        fetch(`/crm/api/projects/?format=json&search=${encodeURIComponent(keyword)}&page_size=10`)
          .then(res => res.json())
          .then(data => {
            if (this._projectSearchToken !== currentToken) return; // 只處理最新請求
            this.projectSuggestions = data.results;
            this.showProjectSuggestions = true;
          });
      }
    },

    // 選擇建議專案
    selectProjectSuggestion(project) {
      this.projectFilter = project.id;
      this.projectSearch = project.name;
      this.showProjectSuggestions = false;
    },

    // 清除專案選擇
    clearProjectSelection() {
      this.projectFilter = '';
      this.projectSearch = '';
      this.projectSuggestions = [];
      this.showProjectSuggestions = false;
      fetch('/crm/api/projects/?format=json&ordering=-id&page_size=10')
        .then(res => res.json())
        .then(data => {
          this.projectSuggestions = data.results;
        });
    },
  },
  mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectParam = urlParams.get('project');
    if (projectParam) {
      this.projectFilter = projectParam;
      fetch(`/crm/api/projects/${projectParam}/?format=json`)
        .then(res => res.json())
        .then(data => {
          this.projectSearch = data.name;
        });
    } else {
      fetch('/crm/api/projects/?format=json&ordering=-id&page_size=10')
        .then(res => res.json())
        .then(data => {
          this.projectSuggestions = data.results;
        });
    }
    this.fetchPayments();
    // document.addEventListener("click", this.handleClickOutside);
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
