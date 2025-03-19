const paymentsList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      projects: [],
      owners: [],
      categories: [],
      users: [],
      isLoading: false,
      searchQuery: "",
      ownerFilter: "",
      startYearFilter: "", // 開始年份
      endYearFilter: "", // 結束年份
      currentPage: 1,
      totalPages: 1,
      pageSize: 10, // 每頁顯示的項目數，可調整
      selectedProjects: new Map(), // 使用 Map 儲存已選擇的專案
      availableYears: [], // 資料庫中現有的年份
      minYear: null, // 最小年份
      maxYear: null, // 最大年份
      projectAmounts: {}, // 專案金額
      projectDescriptions: {}, // 專案描述
      newPayment: {
        payment_number: "",
        date_issued: new Date().toISOString().split("T")[0], // 今天的日期
        due_date: "", // 付款截止日期
        notes: "", // 備註
      },
      selectAllChecked: false, // 全選狀態
    };
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
  },
  methods: {
    // 重設篩選條件
    resetFilters() {
      this.searchQuery = "";
      this.ownerFilter = "";
      this.startYearFilter = "";
      this.endYearFilter = "";
      this.fetchProjects(1); // 重新獲取第一頁數據
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
    // 獲取專案列表
    fetchProjects(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/projects/?format=json&page=${page}&page_size=${this.pageSize}`;

      // 添加搜尋條件
      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      // 添加業主過濾條件
      if (this.ownerFilter) {
        url += `&owner=${this.ownerFilter}`;
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

          // 更新全選狀態
          this.updateSelectAllState();
        })
        .catch((error) => console.error("Error fetching projects:", error))
        .finally(() => {
          this.isLoading = false;
        });
    },
    // 獲取業主列表
    fetchOwners() {
      fetch(`/crm/api/owners/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.owners = data.results;
        })
        .catch((error) => console.error("Error fetching owners:", error));
    },
    // 獲取類別列表
    fetchCategories() {
      fetch(`/crm/api/categories/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.categories = data.results;
        })
        .catch((error) => console.error("Error fetching categories:", error));
    },
    // 獲取用戶列表
    fetchUsers() {
      fetch(`/users/api?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          this.users = data.results;
        })
        .catch((error) => console.error("Error fetching users:", error));
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
        alert("請選擇至少一個專案");
        return;
      }

      // 檢查每個專案是否都有金額
      let isValid = true;
      let totalAmount = 0;

      selectedProjectIds.forEach((projectId) => {
        const amount = this.projectAmounts[projectId];
        if (!amount || amount <= 0) {
          alert("請為每個專案輸入有效的請款金額");
          isValid = false;
          return;
        }
        totalAmount += Number(amount);
      });

      if (!isValid) return;

      // 準備請款單資料
      const paymentData = {
        payment_number: this.newPayment.payment_number,
        date_issued: this.newPayment.date_issued,
        due_date: this.newPayment.due_date || null,
        notes: this.newPayment.notes,
        amount: totalAmount, // 後端會自動計算，這裡是為了完整性
        payment_projects: selectedProjectIds.map((projectId) => ({
          project: projectId,
          amount: this.projectAmounts[projectId],
          description: this.projectDescriptions[projectId] || "",
        })),
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
          alert(`請款單 ${data.payment_number} 已成功建立`);

          // 導航到請款單列表頁面或詳情頁面
          window.location.href = `/crm/payment/${data.id}/details/`;
        })
        .catch((error) => {
          console.error("建立請款單失敗:", error);
          alert("建立請款單失敗，請檢查資料後重試");
        });
    },
  },
  mounted() {
    this.fetchProjects();
    this.fetchOwners();
    this.fetchCategories();
    this.fetchUsers();
    this.fetchYears();
  },
}).mount("#app_main");
