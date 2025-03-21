const paymentList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      payments: [],
      projects: [], // 所有專案
      isLoading: false,
      searchQuery: "",
      paidFilter: "", // 付款狀態過濾
      projectFilter: "", // 專案過濾
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

    // 獲取專案列表，用於專案過濾
    fetchProjects() {
      fetch(`/crm/api/projects/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.projects = data.results;
          // 建立專案 ID 到專案名稱的映射
          this.projects.forEach((project) => {
            this.projectMap[project.id] = project.name;
          });
        })
        .catch((error) => console.error("Error fetching projects:", error));
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

    // 新建請款單
    createNewPayment() {
      window.location.href = "/crm/create_payment/";
    },
  },
  mounted() {
    this.fetchPayments();
    this.fetchProjects();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
