const paymentDetail = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      payment: {
        payment_number: "",
        amount: 0,
        date_issued: "",
        due_date: "",
        paid: false,
        payment_date: null,
        notes: "",
        payment_projects: [],
        invoices: [],
        created_by_name: "",
      },
      paymentId: null,
      projects: [],
      isLoading: true,
      isEditing: false,
      originalPayment: null,
      // 新增發票相關資料
      newInvoice: {
        invoice_number: "",
        amount: 0,
        tax_amount: 0,
        issue_date: "",
        notes: "",
        payment_received_date: null, // 新增
        account_entry_date: null,    // 新增
        payment_method: "",          // 新增
        actual_received_amount: null // 新增
      },
      editingInvoice: false,
      editingInvoiceId: null,
      // 新增專案搜索相關資料
      newProjectItem: {
        project: null,
        amount: 0,
        description: "",
      },
      projectSearchTerm: "",
      showProjectDropdown: false,
      filteredProjects: [],
      // 目前活躍的Tab
      activeTab: "projects_tab", // 預設顯示專案明細分頁

      // 新增專案相關資料 (擴充)
      selectedProjectIds: [], // 新增：選中的專案ID列表
      projectAmounts: {}, // 新增：專案金額
      projectDescriptions: {}, // 新增：專案描述
      selectAllChecked: false, // 新增：全選狀態
      filteredProjectsForModal: [], // 新增：用於Modal的過濾後專案列表

      // 業主搜索相關資料 (從create_payment借鑒)
      ownerFilter: "", // 業主篩選條件
      ownerSearchText: "", // 業主搜尋文字
      filteredOwners: [], // 過濾後的業主列表
      showOwnerDropdown: false, // 是否顯示業主下拉選單
      owners: [], // 業主列表
      // 新增：發票付款方式選項
      paymentMethodChoices: [
        { value: 'cash', display: '現金' },
        { value: 'bank_transfer', display: '銀行轉帳' },
        { value: 'check', display: '支票' },
        { value: 'credit_card', display: '信用卡' },
        { value: 'other', display: '其他' },
      ],
    };
  },
  methods: {
    // 獲取付款詳情
    fetchPaymentDetails() {
      this.isLoading = true;
      return fetch(`/crm/api/payments/${this.paymentId}/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法獲取請款單詳情");
          }
          return response.json();
        })
        .then((data) => {
          
          this.payment = data;
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: 'error',
            title: '錯誤',
            text: "獲取請款單資料失敗：" + error.message,
          });
        })
        .finally(() => {
          this.isLoading = false;
          this.$nextTick(() => {
            // Vue DOM 更新完成
            const currentActiveTabId = this.activeTab;
            if (currentActiveTabId) {
              const tabElement = document.querySelector(`a[data-bs-toggle="tab"][href="#${currentActiveTabId}"]`);
              if (tabElement) {
                const tab = new bootstrap.Tab(tabElement);
                tab.show();
              }
            }
          });
        });
    },

    // 獲取所有專案，用於編輯時選擇
    fetchProjects() {
      fetch("/crm/api/projects/?format=json&page_size=1000")
        .then((response) => response.json())
        .then((data) => {
          this.projects = data.results;
        })
        .catch((error) => console.error("Error fetching projects:", error));
    },

    // 新增業主列表獲取方法
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

    // 搜尋業主
    searchOwners() {
      if (!this.ownerSearchText.trim()) {
        this.filteredOwners = this.owners.slice(0, 10); // 顯示前10個
        return;
      }

      const searchText = this.ownerSearchText.toLowerCase().trim();
      this.filteredOwners = this.owners
        .filter(
          (owner) =>
            owner.company_name.toLowerCase().includes(searchText) ||
            (owner.tax_id && owner.tax_id.includes(searchText))
        )
        .slice(0, 10); // 最多顯示10個結果

      this.showOwnerDropdown = true;
    },

    // 選擇業主
    selectOwner(owner) {
      this.ownerFilter = owner.id;
      this.ownerSearchText = owner.company_name;
      this.showOwnerDropdown = false;
      this.filterProjectsForModal(); // 重新過濾專案列表
    },

    // 清除業主選擇
    clearOwnerSelection() {
      this.ownerFilter = "";
      this.ownerSearchText = "";
      this.filteredOwners = [];
      this.showOwnerDropdown = false;
      this.filterProjectsForModal(); // 重新過濾專案列表
    },

    // 關閉業主下拉選單
    closeOwnerDropdown() {
      this.showOwnerDropdown = false;
    },

    // 格式化日期顯示
    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    },

    // 格式化金額顯示
    formatCurrency(value) {
      if (value === null || value === undefined) return "-";
      return new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
        minimumFractionDigits: 0,
      }).format(value);
    },

    // 新增：獲取付款方式顯示名稱
    getPaymentMethodDisplay(value) {
      if (!value) return "-";
      const choice = this.paymentMethodChoices.find(c => c.value === value);
      return choice ? choice.display : value;
    },

    // 獲取狀態標籤樣式
    getStatusBadgeClass() {
      return this.payment.paid ? "badge-light-success" : "badge-light-warning";
    },

    // 計算所有專案項目的總金額
    getTotalAmount() {
      if (
        !this.payment.payment_projects ||
        this.payment.payment_projects.length === 0
      ) {
        return 0;
      }
      return this.payment.payment_projects.reduce((total, item) => {
        return total + Number(item.amount || 0);
      }, 0);
    },

    // 切換編輯模式
    toggleEditMode() {
      this.isEditing = !this.isEditing;
    },

    // 取消編輯
    cancelEdit() {
      this.isEditing = false;
      // 還原資料
      if (this.originalPayment) {
        this.payment = JSON.parse(JSON.stringify(this.originalPayment));
      }
    },

    // 保存修改
    saveChanges() {
      // 計算總金額
      const totalAmount = this.getTotalAmount();

      // 驗證必填欄位
      if (!this.payment.payment_number) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請輸入請款單號',
        });
        return;
      }

      if (!this.payment.date_issued) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請選擇請款日期',
        });
        return;
      }

      // 驗證專案明細
      if (this.payment.payment_projects.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請至少添加一個專案明細',
        });
        return;
      }

      for (let item of this.payment.payment_projects) {
        if (!item.project) {
          Swal.fire({
            icon: 'warning',
            title: '提示',
            text: '請為每一個明細選擇專案',
          });
          return;
        }

        if (!item.amount || item.amount <= 0) {
          Swal.fire({
            icon: 'warning',
            title: '提示',
            text: '請為每一個明細輸入有效的金額',
          });
          return;
        }
      }

      // 準備更新資料
      const updateData = {
        payment_number: this.payment.payment_number,
        date_issued: this.payment.date_issued,
        due_date: this.payment.due_date,
        paid: this.payment.paid,
        payment_date: this.payment.paid ? this.payment.payment_date : null,
        notes: this.payment.notes,
      };

      // 更新請款單基本資料
      fetch(`/crm/api/payments/${this.paymentId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]')
            .value,
        },
        body: JSON.stringify(updateData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("更新請款單失敗");
          }
          return response.json();
        })
        .then(() => {
          // 處理專案明細
          const projectPromises = [];

          // 更新或新增專案明細
          this.payment.payment_projects.forEach((item) => {
            const projectItemData = {
              payment: this.paymentId,
              project: item.project,
              amount: item.amount,
              description: item.description || "",
            };

            if (item.id) {
              // 更新現有的專案明細
              projectPromises.push(
                fetch(`/crm/api/payment-projects/${item.id}/`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector(
                      '[name="csrfmiddlewaretoken"]'
                    ).value,
                  },
                  body: JSON.stringify(projectItemData),
                })
              );
            } else {
              // 新增專案明細
              projectPromises.push(
                fetch("/crm/api/payment-projects/", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector(
                      '[name="csrfmiddlewaretoken"]'
                    ).value,
                  },
                  body: JSON.stringify(projectItemData),
                })
              );
            }
          });

          return Promise.all(projectPromises);
        })
        .then(() => {
          this.isEditing = false;
          Swal.fire({
            icon: 'success',
            title: '成功',
            text: '請款單更新成功',
          });
          // const currentActiveTabId = this.activeTab; // 儲存目前的 activeTab
          this.fetchPaymentDetails(); // 重新獲取資料

          // // 確保 DOM 更新後，恢復到之前的分頁
          // return this.fetchPaymentDetails().then(() => {
          //   this.$nextTick(() => {
          //     if (currentActiveTabId) {
          //       // 使用 currentActiveTabId 來選取正確的分頁連結
          //       const tabElement = document.querySelector(`a[data-bs-toggle="tab"][href="#${currentActiveTabId}"]`);
          //       if (tabElement) {
          //         const tab = new bootstrap.Tab(tabElement);
          //         tab.show();
          //       }
          //     }
          //   });
          // });
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: 'error',
            title: '錯誤',
            text: "更新請款單失敗：" + error.message,
          });
        });
    },

    // 添加專案項目 - 修改為打開多選對話框
    addProjectItem() {
      // 重置相關狀態
      this.projectSearchTerm = "";
      this.selectedProjectIds = [];
      this.projectAmounts = {};
      this.projectDescriptions = {};
      this.selectAllChecked = false;

      // 過濾可選專案 (排除已經在請款單中的專案)
      this.filterProjectsForModal();

      // 顯示模態對話框
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
    },

    // 過濾Modal中的專案列表
    filterProjectsForModal() {
      // 排除已經在請款單中的專案
      let existingProjectIds = this.payment.payment_projects
        .map((item) => item.project)
        .filter((id) => id); // 過濾掉可能的null或undefined值

      // 篩選專案
      let filtered = this.projects.filter((project) => {
        // 排除已經在請款單中的專案
        if (existingProjectIds.includes(project.id)) {
          return false;
        }

        // 根據搜索詞過濾
        const nameMatch =
          !this.projectSearchTerm ||
          project.name
            .toLowerCase()
            .includes(this.projectSearchTerm.toLowerCase());

        // 根據業主過濾
        const ownerMatch =
          !this.ownerFilter || project.owner === parseInt(this.ownerFilter);

        return nameMatch && ownerMatch;
      });

      // 更新過濾結果
      this.filteredProjectsForModal = filtered;
    },

    // 搜尋專案 (用於Modal內的搜尋)
    searchProjects() {
      this.filterProjectsForModal();
    },

    // 全選/取消全選專案
    selectAllProjects() {
      if (this.selectAllChecked) {
        // 全選
        this.selectedProjectIds = this.filteredProjectsForModal.map(
          (p) => p.id
        );
      } else {
        // 取消全選
        this.selectedProjectIds = [];
      }
    },

    // 更新全選狀態
    updateSelectAllState() {
      if (this.filteredProjectsForModal.length > 0) {
        this.selectAllChecked = this.filteredProjectsForModal.every((project) =>
          this.selectedProjectIds.includes(project.id)
        );
      } else {
        this.selectAllChecked = false;
      }
    },

    // 根據ID獲取專案名稱
    getProjectName(projectId) {
      const project = this.projects.find((p) => p.id === projectId);
      return project ? project.name : "";
    },

    // 確認添加選中的專案 (簡化版本，不再需要檢查金額)
    addSelectedProjects() {
      // 將選中的專案添加到請款單中，金額預設為0
      this.selectedProjectIds.forEach((projectId) => {
        const project = this.projects.find((p) => p.id === projectId);
        if (project) {
          this.payment.payment_projects.push({
            project: projectId,
            project_name: project.name,
            amount: 0, // 預設金額為0
            description: "", // 預設描述為空白
          });
        }
      });

      // 關閉對話框
      this.hideAddProjectModal();
    },

    hideAddProjectModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addProjectModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    searchProjects() {
      if (!this.projectSearchTerm) {
        this.filteredProjects = [...this.projects];
        return;
      }

      const term = this.projectSearchTerm.toLowerCase();
      this.filteredProjects = this.projects.filter(
        (project) =>
          project.name.toLowerCase().includes(term) ||
          (project.owner_name &&
            project.owner_name.toLowerCase().includes(term))
      );
    },

    selectProject(project) {
      this.newProjectItem.project = project.id;
      this.projectSearchTerm = project.name;
      this.showProjectDropdown = false;
    },

    submitProjectForm() {
      if (!this.newProjectItem.project) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請選擇專案',
        });
        return;
      }

      if (!this.newProjectItem.amount || this.newProjectItem.amount <= 0) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請輸入有效的金額',
        });
        return;
      }

      // 找到選擇的專案完整資訊
      const selectedProject = this.projects.find(
        (p) => p.id === this.newProjectItem.project
      );

      this.payment.payment_projects.push({
        project: this.newProjectItem.project,
        project_name: selectedProject ? selectedProject.name : "",
        amount: this.newProjectItem.amount,
        description: this.newProjectItem.description || "",
      });

      this.hideAddProjectModal();
    },

    closeProjectDropdown() {
      this.showProjectDropdown = false;
    },

    // 移除專案項目
    removeProjectItem(index) {
      const item = this.payment.payment_projects[index];

      if (item.id) {
        // 如果是資料庫中的項目，需要發送刪除請求
        if (confirm("確定要刪除此專案明細嗎？")) {
          fetch(`/crm/api/payment-projects/${item.id}/`, {
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
              this.payment.payment_projects.splice(index, 1);
            })
            .catch((error) => {
              console.error("Error:", error);
              Swal.fire({
                icon: 'error',
                title: '錯誤',
                text: "刪除專案明細失敗：" + error.message,
              });
            });
        }
      } else {
        // 如果是新增的項目，直接從陣列中移除
        this.payment.payment_projects.splice(index, 1);
      }
    },

    // 創建發票
    createInvoice() {
      this.editingInvoice = false;
      this.editingInvoiceId = null;
      this.newInvoice = {
        invoice_number: "",
        amount: 0,
        tax_amount: 0,
        issue_date: new Date().toISOString().split("T")[0],
        notes: "",
        payment_received_date: null, // 新增初始化
        account_entry_date: null,    // 新增初始化
        payment_method: "",          // 新增初始化
        actual_received_amount: null // 新增初始化
      };

      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
    },

    // 顯示編輯發票 Modal
    editInvoice(invoiceId) {
      this.editingInvoice = true;
      this.editingInvoiceId = invoiceId;

      // 找到對應的發票
      const invoice = this.payment.invoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        this.newInvoice = { ...invoice };
      }

      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
    },

    // 隱藏發票 Modal
    hideAddInvoiceModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addInvoiceModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 提交發票表單
    submitInvoiceForm() {
      // 驗證必填欄位
      if (!this.newInvoice.invoice_number) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請輸入發票號碼',
        });
        return;
      }

      if (!this.newInvoice.amount || this.newInvoice.amount <= 0) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請輸入有效的發票金額',
        });
        return;
      }

      if (!this.newInvoice.issue_date) {
        Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請選擇開立日期',
        });
        return;
      }

      const invoiceData = {
        invoice_number: this.newInvoice.invoice_number,
        amount: this.newInvoice.amount,
        tax_amount: this.newInvoice.tax_amount || 0,
        issue_date: this.newInvoice.issue_date,
        notes: this.newInvoice.notes || "",
        payment: this.paymentId,
        payment_received_date: this.newInvoice.payment_received_date || null, // 新增
        account_entry_date: this.newInvoice.account_entry_date || null,       // 新增
        payment_method: this.newInvoice.payment_method || null,             // 新增
        actual_received_amount: this.newInvoice.actual_received_amount || null // 新增
      };

      let url = "/crm/api/invoices/";
      let method = "POST";

      // 如果是編輯發票
      if (this.editingInvoice && this.editingInvoiceId) {
        url = `/crm/api/invoices/${this.editingInvoiceId}/`;
        method = "PATCH";
      }

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]')
            .value,
        },
        body: JSON.stringify(invoiceData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("發票操作失敗");
          }
          return response.json();
        })
        .then(() => {
          this.hideAddInvoiceModal();
          this.fetchPaymentDetails(); // 重新獲取資料
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: 'error',
            title: '錯誤',
            text: "發票操作失敗：" + error.message,
          });
        });
    },

    // 刪除發票
    deleteInvoice(invoiceId) {
      Swal.fire({
        title: '確定要刪除此發票嗎？',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: '是的，刪除它！',
        cancelButtonText: '取消'
      }).then((result) => {
        if (result.isConfirmed) {
          fetch(`/crm/api/invoices/${invoiceId}/`, {
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
              this.fetchPaymentDetails(); // 重新獲取資料
              Swal.fire(
                '已刪除!',
                '發票已被刪除。',
                'success'
              )
            })
            .catch((error) => {
              console.error("Error:", error);
              Swal.fire({
                icon: 'error',
                title: '錯誤',
                text: "刪除發票失敗：" + error.message,
              });
            });
        }
      });
    },

    // Tab 切換處理
    handleTabChange(tabId) {
      this.activeTab = tabId;
    },
    
    // 匯出Excel功能
    exportToExcel() {
      window.location.href = `/crm/payment/${this.paymentId}/export_excel/`;
    },
  },
  mounted() {
    // 從URL獲取payment ID
    const pathParts = window.location.pathname.split("/");
    this.paymentId = pathParts[pathParts.indexOf("payment") + 1];

    // 獲取資料
    this.fetchPaymentDetails();
    this.fetchProjects();
    this.fetchOwners(); // 新增：獲取業主列表
    // 初始化 Bootstrap tabs
    this.$nextTick(() => {
      // 確保元素已經渲染完成
      const tabElements = document.querySelectorAll('a[data-bs-toggle="tab"]');

      // 監聽Tab切換事件
      tabElements.forEach((tabEl) => {
        tabEl.addEventListener("shown.bs.tab", (event) => {
          // 提取不含#的tab ID
          const tabId = event.target.getAttribute("href").substring(1);
          this.activeTab = tabId;
          console.log("Tab changed to:", this.activeTab);
        });
      });
    });
  },
});

// 註冊自定義指令 v-click-outside
paymentDetail.directive("click-outside", {
  beforeMount(el, binding) {
    el.clickOutsideEvent = function (event) {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener("click", el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener("click", el.clickOutsideEvent);
  },
});

paymentDetail.mount("#app_main");
