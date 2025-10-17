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
        company: null,
        company_name: "",
        selected_bank_account: null, // 新增選定的銀行帳號ID
        selected_bank_account_details: null, // 新增選定銀行帳號的詳細資訊
      },
      paymentId: null,
      projects: [], // 保留用於新增專案的搜尋功能
      isLoading: true,
      isEditing: false,
      originalPayment: null,
      // 新增發票相關資料
      newInvoice: {
        id: null,
        invoice_type: "normal", // 新增發票類型
        invoice_number: "",
        amount: 0, // 未稅金額
        tax_amount: 0,
        issue_date: "",
        notes: "",
        payment_received_date: null, // 新增
        account_entry_date: null, // 新增
        payment_method: "", // 新增
        actual_received_amount: null, // 新增
        gross_amount: 0, // 含稅金額
        payment_status: "unpaid", // 新的付款狀態
        is_paid: false, // 保留舊欄位以保持相容性
        project_amounts: [ { project_id: '', amount: '' } ], // 初始化為一筆
      },
      editingInvoice: false,
      editingInvoiceId: null,
      // 新增表單驗證相關
      validationErrors: {},
      dateErrors: {}, // 新增日期錯誤狀態
      dateWarning: {}, // 新增日期警告狀態
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

      // Modal 專案搜尋和分頁相關
      modalProjects: [], // Modal 中的專案列表
      isLoadingModalProjects: false, // Modal 載入狀態
      projectPagination: null, // 專案分頁資訊
      currentProjectPage: 1, // 當前專案頁面
      projectModalSearchTerm: "", // Modal 搜尋關鍵字
      projectSearchTimeout: null, // 搜尋防抖計時器
      
      // Modal 篩選條件
      modalOwnerFilter: "", // Modal 業主篩選
      modalCategoryFilter: "", // Modal 類別篩選
      modalStartYearFilter: "", // Modal 開始年份篩選
      modalEndYearFilter: "", // Modal 結束年份篩選
      modalCompletedFilter: "", // Modal 完成狀態篩選
      
      // 基礎資料
      categories: [], // 類別列表
      availableYears: [], // 可用年份
      minYear: null, // 最小年份
      maxYear: null, // 最大年份

      // 業主搜索相關資料 (從create_payment借鑒)
      ownerFilter: "", // 業主篩選條件
      ownerSearchText: "", // 業主搜尋文字
      filteredOwners: [], // 過濾後的業主列表
      showOwnerDropdown: false, // 是否顯示業主下拉選單
      owners: [], // 業主列表
      // 新增：發票付款方式選項
      paymentMethodChoices: [
        { value: "cash", display: "現金" },
        { value: "bank_transfer", display: "銀行轉帳" },
        { value: "check", display: "支票" },
        { value: "credit_card", display: "信用卡" },
        { value: "other", display: "其他" },
      ],
      companys: [], // 添加公司列表
      bankAccounts: [], // 新增銀行帳戶列表
      loadingBankAccounts: false, // 新增加載銀行帳戶狀態
      // 新增銀行帳號對話框相關數據
      bankAccountModal: {
        show: false,
        account_name: "",
        account_number: "",
        bank_name: "",
        bank_code: "",
        company: null, // 將與當前選中的公司關聯
      },
      // 專案報告書名稱映射表 - 移除，改用 payment_projects 中的 report_name
      // projectReportNames: {}, // 專案ID -> 報告書名稱的映射
      // 內存請款單相關資料
      paymentDocuments: [], // 內存請款單文件列表
      isUploadingDocument: false, // 上傳狀態
      
      // 收款記錄相關資料
      projectReceipts: [], // 收款記錄列表
      newProjectReceipt: {
        id: null,
        project: null,
        amount: null,
        payment_date: null,
        payment_method: "",
      },
      editingProjectReceipt: false,
      editingProjectReceiptId: null,
    };
  },
  computed: {
    // 新增 computed 屬性
    totalInvoiceAmount() {
      if (
        !this.payment ||
        !this.payment.invoices ||
        this.payment.invoices.length === 0
      ) {
        return 0;
      }
      return this.payment.invoices.reduce((total, invoice) => {
        return total + Number(invoice.amount || 0);
      }, 0);
    },
    totalInvoiceTaxAmount() {
      if (
        !this.payment ||
        !this.payment.invoices ||
        this.payment.invoices.length === 0
      ) {
        return 0;
      }
      return this.payment.invoices.reduce((total, invoice) => {
        return total + Number(invoice.tax_amount || 0);
      }, 0);
    },
    totalActualReceivedAmount() {
      if (!this.payment || !this.payment.invoices || this.payment.invoices.length === 0) {
        return 0;
      }
      return this.payment.invoices.reduce((total, invoice) => {
        return total + Number(invoice.actual_received_amount || 0);
      }, 0);
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
  watch: {
    // 監聽 newInvoice.project_amounts，自動加總金額到 gross_amount
    'newInvoice.project_amounts': {
      handler(val) {
        // 自動加總所有專案金額
        const total = val.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        this.newInvoice.gross_amount = total;
        // 同步更新未稅金額與稅額
        this.handleGrossAmountChange();
      },
      deep: true
    }
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

          // 確保所有陣列屬性都正確初始化
          if (!this.payment.payment_projects) {
            this.payment.payment_projects = [];
          }
          if (!this.payment.invoices) {
            this.payment.invoices = [];
          }

          // 如果請款單已經有公司和銀行帳號，獲取銀行帳號詳情
          if (data.company && !this.isEditing) {
            this.fetchBankAccounts(data.company);
            // 在獲取到帳號列表後，設置已選帳號的詳細資訊
            if (data.selected_bank_account) {
              setTimeout(() => {
                const selectedAccount = this.bankAccounts.find(
                  (acc) => acc.id === data.selected_bank_account
                );
                if (selectedAccount) {
                  this.payment.selected_bank_account_details = selectedAccount;
                }
              }, 500); // 給銀行帳號API一些加載時間
            }
          }

          // 處理 payment_projects 的變更次數資料
          if (this.payment.payment_projects) {
            this.payment.payment_projects.forEach((project) => {
              project.change_count = project.change_count || 0; // 確保變更次數有值
            });
          }

          // 載入收款記錄
          if (this.payment.project_receipts) {
            this.projectReceipts = this.payment.project_receipts;
          } else {
            this.fetchProjectReceipts();
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: "獲取請款單資料失敗：" + error.message,
          });
        })
        .finally(() => {
          this.isLoading = false;
          this.$nextTick(() => {
            // Vue DOM 更新完成
            const currentActiveTabId = this.activeTab;
            if (currentActiveTabId) {
              const tabElement = document.querySelector(
                `a[data-bs-toggle="tab"][href="#${currentActiveTabId}"]`
              );
              if (tabElement) {
                const tab = new bootstrap.Tab(tabElement);
                tab.show();
              }
            }
          });
        });
    },

    // 獲取專案列表，僅用於新增專案時選擇
    fetchProjectsForSelection() {
      // 只有在需要新增專案時才載入專案列表
      if (this.projects.length > 0) return Promise.resolve();
      
      return fetch("/crm/api/projects/?format=json&page_size=1000")
        .then((response) => response.json())
        .then((data) => {
          this.projects = data.results;
        })
        .catch((error) => console.error("Error fetching projects:", error));
    },

    // 移除不再需要的方法
    // initializeProjectReportNames() - 已移除
    // fetchProjects() - 重命名為 fetchProjectsForSelection

    // 獲取專案的報告書名稱 - 直接從 payment_projects 中取得
    getProjectReportName(projectItem) {
      return projectItem.report_name || '';
    },    
    
    // 更新專案的報告書名稱 - 僅更新本地數據，保存時再傳送到後端
    updateProjectReportName(projectId, reportName) {
      // 更新本地 payment_projects 中的 report_name
      const projectItem = this.payment.payment_projects.find(item => item.project === projectId);
      if (projectItem) {
        projectItem.report_name = reportName;
      }
      
      // 移除即時更新到後端的邏輯，改為在保存時統一處理
    },

    // 批量更新所有已修改專案的報告書名稱 - 在保存時調用
    updateProjectReportNames() {
      const updatePromises = [];

      // 只保留有填寫報告書名稱的專案
      const modifiedProjects = this.payment.payment_projects.filter(item =>
        item.report_name !== undefined &&
        item.report_name !== null &&
        item.report_name !== ""
      );      

      // 更新有填寫報告書名稱的專案的報告書名稱
      modifiedProjects.forEach((projectItem) => {
        if (projectItem.project && projectItem.report_name !== undefined) {
          updatePromises.push(
            fetch(`/crm/api/projects/${projectItem.project}/`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]').value,
              },
              body: JSON.stringify({
                report_name: projectItem.report_name || '',
              }),
            }).catch(error => {
              console.error(`Error updating project ${projectItem.project} report name:`, error);
            })
          );
        }
      });

      return Promise.all(updatePromises);
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

    // 獲取公司列表
    fetchCompanys() {
      fetch("/crm/api/companys/?format=json")
        .then((response) => response.json())
        .then((data) => {
          this.companys = data.results || [];
        })
        .catch((error) => console.error("Error fetching companys:", error));
    },

    // 獲取類別列表
    fetchCategories() {
      fetch(`/crm/api/categories/?format=json&page_size=1000`)
        .then((response) => response.json())
        .then((data) => {
          if (data && data.results) {
            this.categories = data.results;
          } else {
            this.categories = [];
          }
        })
        .catch((error) => {
          console.error("Error fetching categories:", error);
          this.categories = [];
        });
    },

    // 獲取可用年份
    fetchYears() {
      fetch(`/crm/api/projects/years/`)
        .then((response) => response.json())
        .then((data) => {
          if (data && data.years) {
            this.availableYears = data.years;
            this.minYear = data.min_year;
            this.maxYear = data.max_year;
          } else {
            this.availableYears = [];
            this.minYear = null;
            this.maxYear = null;
          }
        })
        .catch((error) => {
          console.error("Error fetching years:", error);
          this.availableYears = [];
          this.minYear = null;
          this.maxYear = null;
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

    // 檔案上傳相關方法
    // 觸發檔案選擇
    triggerFileUpload() {
      const fileInput = document.getElementById('paymentDocumentFileInput');
      if (fileInput) {
        fileInput.click();
      }
    },

    // 處理檔案選擇
    handleFileSelection(event) {
      const file = event.target.files[0];
      if (!file) return;

      // 檔案大小驗證 (1MB = 1024 * 1024 bytes)
      const maxSize = 1024 * 1024; // 1MB
      if (file.size > maxSize) {
        Swal.fire({
          icon: 'error',
          title: '檔案過大',
          text: '檔案大小不能超過 1MB',
        });
        event.target.value = ''; // 清空選擇
        return;
      }

      this.uploadDocument(file);
    },

    // 上傳檔案
    uploadDocument(file) {
      this.isUploadingDocument = true;
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('payment', this.paymentId);

      Swal.fire({
        title: '正在上傳檔案...',
        text: '請稍候',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      fetch('/crm/api/payment-documents/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value,
        },
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.error || '上傳失敗');
          });
        }
        return response.json();
      })      
      .then(_data => {
        Swal.fire({
          icon: 'success',
          title: '上傳成功',
          text: '檔案已成功上傳',
          timer: 1500,
        });
        
        // 重新獲取檔案列表
        this.fetchPaymentDocuments(); // TODO
        
        // 清空檔案輸入
        const fileInput = document.getElementById('paymentDocumentFileInput');
        if (fileInput) {
          fileInput.value = '';
        }
      })
      .catch(error => {
        console.error('Upload error:', error);
        Swal.fire({
          icon: 'error',
          title: '上傳失敗',
          text: error.message || '檔案上傳失敗，請重試',
        });
      })
      .finally(() => {
        this.isUploadingDocument = false;
      });
    },

    // 獲取檔案列表
    fetchPaymentDocuments() {
      fetch(`/crm/api/payment-documents/?payment=${this.paymentId}`)
        .then(response => response.json())
        .then(data => {
          this.paymentDocuments = data.results || data;
        })
        .catch(error => {
          console.error('Error fetching documents:', error);
        });
    },    // 下載檔案
    downloadDocument(documentId, _filename) {
      window.open(`/crm/api/payment-documents/${documentId}/download/`, '_blank');
    },

    // 刪除檔案
    deleteDocument(documentId, filename) {
      Swal.fire({
        title: '確定要刪除檔案嗎？',
        text: `檔案：${filename}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '是的，刪除',
        cancelButtonText: '取消'
      }).then((result) => {
        if (result.isConfirmed) {
          fetch(`/crm/api/payment-documents/${documentId}/`, {
            method: 'DELETE',
            headers: {
              'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value,
            }
          })
          .then(response => {
            if (!response.ok) {
              throw new Error('刪除失敗');
            }
            
            Swal.fire({
              icon: 'success',
              title: '刪除成功',
              text: '檔案已成功刪除',
              timer: 1500,
            });
            
            // 重新獲取檔案列表
            this.fetchPaymentDocuments();
          })
          .catch(error => {
            console.error('Delete error:', error);
            Swal.fire({
              icon: 'error',
              title: '刪除失敗',
              text: '檔案刪除失敗，請重試',
            });
          });
        }
      });
    },

    // 格式化檔案大小顯示
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },    // 格式化日期顯示
    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    },

    // 格式化日期時間顯示
    formatDateTime(dateTimeString) {
      if (!dateTimeString) return "-";
      const date = new Date(dateTimeString);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(
        2,
        "0"
      )}:${String(date.getMinutes()).padStart(2, "0")}`;
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
      const choice = this.paymentMethodChoices.find((c) => c.value === value);
      return choice ? choice.display : value;
    },

    // 獲取狀態標籤樣式
    getStatusBadgeClass() {
      return this.payment.paid ? "badge-success" : "badge-warning";
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
      // 驗證必填欄位
      if (!this.payment.payment_number) {
        Swal.fire({
          icon: "warning",
          title: "提示",
          text: "請輸入請款單號",
        });
        return;
      }

      if (!this.payment.company) {
        Swal.fire({
          icon: "warning",
          title: "提示",
          text: "請選擇收款公司",
        });
        return;
      }

      if (!this.payment.date_issued) {
        Swal.fire({
          icon: "warning",
          title: "提示",
          text: "請選擇請款日期",
        });
        return;
      }

      // 驗證專案明細
      if (this.payment.payment_projects.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "提示",
          text: "請至少添加一個專案明細",
        });
        return;
      }

      for (let item of this.payment.payment_projects) {
        if (!item.project) {
          Swal.fire({
            icon: "warning",
            title: "提示",
            text: "請為每一個明細選擇專案",
          });
          return;
        }

        if (item.amount === null || item.amount === '' || item.amount < 0) {
          Swal.fire({
            icon: "warning",
            title: "提示",
            text: "請為每一個明細輸入有效的金額",
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
        company: this.payment.company, // 收款公司欄位
        selected_bank_account: this.payment.selected_bank_account, // 添加銀行帳號欄位
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
          // 更新專案的報告書名稱
          return this.updateProjectReportNames();
        })
        .then(() => {
          this.isEditing = false;
          Swal.fire({
            icon: "success",
            title: "成功",
            text: "請款單更新成功",
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
            icon: "error",
            title: "錯誤",
            text: "更新請款單失敗：" + error.message,
          });
        });
    },

    // 添加專案項目 - 修改為打開多選對話框支援分頁
    addProjectItem() {
      // 重置相關狀態
      this.projectModalSearchTerm = "";
      this.selectedProjectIds = [];
      this.projectAmounts = {};
      this.projectDescriptions = {};
      this.selectAllChecked = false;
      this.currentProjectPage = 1;
      
      // 重置篩選條件
      this.resetModalFilters();

      // 顯示模態對話框
      const modal = new bootstrap.Modal(
        document.getElementById("addProjectModal")
      );
      modal.show();
      
      // modal 顯示後自動載入資料並 focus 到搜尋欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.modalProjectSearchInput) {
            this.$refs.modalProjectSearchInput.focus();
          }
        });
        // 載入初始資料
        this.loadModalProjects();
      }, { once: true });
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

    // 重置模態框篩選條件
    resetModalFilters() {
      this.modalOwnerFilter = "";
      this.modalCategoryFilter = "";
      this.modalStartYearFilter = "";
      this.modalEndYearFilter = "";
      this.modalCompletedFilter = "";
    },

    // 載入 Modal 專案資料（支援分頁和搜尋）
    loadModalProjects(url = null) {
      this.isLoadingModalProjects = true;
      
      // 建構 API URL
      let apiUrl = url || "/crm/api/projects/";
      const params = new URLSearchParams();
      
      if (!url) {
        params.append("format", "json");
        params.append("page_size", "10"); // 每頁顯示10筆
        params.append("page", this.currentProjectPage.toString());

        // 搜尋條件
        if (this.projectModalSearchTerm.trim()) {
          params.append("search", this.projectModalSearchTerm.trim());
        }

        // 業主篩選
        if (this.modalOwnerFilter) {
          params.append("owner", this.modalOwnerFilter);
        } else {
          // 使用當前請款單的業主
          if (this.payment && this.payment.owner) {
            params.append("owner", this.payment.owner);
          }
        }

        // 類別篩選
        if (this.modalCategoryFilter) {
          params.append("category", this.modalCategoryFilter);
        }

        // 年份篩選
        if (this.modalStartYearFilter) {
          params.append("year_start", this.modalStartYearFilter);
        }

        if (this.modalEndYearFilter) {
          params.append("year_end", this.modalEndYearFilter);
        }

        // 完成狀態篩選
        if (this.modalCompletedFilter) {
          params.append("is_completed", this.modalCompletedFilter);
        }

        // 排除已經在當前請款單中的專案
        if (this.payment && this.payment.payment_projects) {
          const existingProjectIds = this.payment.payment_projects
            .map(item => item.project)
            .filter(id => id);
          if (existingProjectIds.length > 0) {
            params.append("exclude_projects", existingProjectIds.join(','));
          }
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
          this.modalProjects = data.results || [];
          
          // 更新分頁資訊
          this.projectPagination = {
            count: data.count,
            next: data.next,
            previous: data.previous,
          };
          
          // 更新當前頁面
          if (url) {
            const urlObj = new URL(url);
            const pageParam = urlObj.searchParams.get('page');
            if (pageParam) {
              this.currentProjectPage = parseInt(pageParam);
            }
          }

          // 更新全選狀態
          this.updateModalSelectAllState();
        })
        .catch((error) => {
          console.error("載入專案時發生錯誤:", error);
          this.modalProjects = [];
          this.projectPagination = null;
        })
        .finally(() => {
          this.isLoadingModalProjects = false;
        });
    },

    // Modal 專案搜尋（防抖處理）
    searchModalProjects() {
      // 清除之前的計時器
      if (this.projectSearchTimeout) {
        clearTimeout(this.projectSearchTimeout);
      }
      
      // 設置新的計時器，300ms後執行搜尋
      this.projectSearchTimeout = setTimeout(() => {
        this.currentProjectPage = 1;
        this.loadModalProjects();
      }, 300);
    },

    // 前往特定專案頁面
    goToModalProjectPage(page) {
      this.currentProjectPage = page;
      this.loadModalProjects();
    },

    // 取得專案頁碼陣列（用於分頁顯示）
    getModalProjectPageNumbers() {
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
          // 當前頁在前段
          for (let i = 1; i <= 5; i++) pages.push(i);
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 3) {
          // 當前頁在後段
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
        } else {
          // 當前頁在中段
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    },

    // Modal 全選/取消全選專案
    selectAllModalProjects() {
      this.selectAllChecked = !this.selectAllChecked;

      if (this.selectAllChecked) {
        // 全選當前頁面的專案
        this.modalProjects.forEach((project) => {
          if (!this.selectedProjectIds.includes(project.id)) {
            this.selectedProjectIds.push(project.id);
            // 設置預設金額
            if (!this.projectAmounts[project.id]) {
              this.projectAmounts[project.id] = 0;
            }
          }
        });
      } else {
        // 取消選擇當前頁面的專案
        this.modalProjects.forEach((project) => {
          const index = this.selectedProjectIds.indexOf(project.id);
          if (index > -1) {
            this.selectedProjectIds.splice(index, 1);
            delete this.projectAmounts[project.id];
          }
        });
      }
    },

    // 更新 Modal 全選狀態
    updateModalSelectAllState() {
      if (this.modalProjects.length > 0) {
        this.selectAllChecked = this.modalProjects.every((project) =>
          this.selectedProjectIds.includes(project.id)
        );
      } else {
        this.selectAllChecked = false;
      }
    },

    // 切換專案選擇狀態
    toggleModalProjectSelection(project) {
      const index = this.selectedProjectIds.indexOf(project.id);
      if (index > -1) {
        this.selectedProjectIds.splice(index, 1);
        delete this.projectAmounts[project.id];
      } else {
        this.selectedProjectIds.push(project.id);
        // 設置預設金額
        if (!this.projectAmounts[project.id]) {
          this.projectAmounts[project.id] = 0;
        }
      }

      // 更新全選狀態
      this.updateModalSelectAllState();
    },

    // 檢查專案是否被選取
    isModalProjectSelected(projectId) {
      return this.selectedProjectIds.includes(projectId);
    },

    // 根據ID獲取專案名稱
    getProjectName(projectId) {
      const project = this.projects.find((p) => p.id === projectId);
      return project ? project.name : "";
    },

    // 根據專案ID獲取專案名稱（用於發票顯示）
    getProjectNameById(projectId) {
      // 先從請款單的專案中查找
      const paymentProject = this.payment.payment_projects?.find(
        (pp) => pp.project === projectId
      );
      if (paymentProject) {
        return paymentProject.project_name;
      }
      // 如果沒找到，則從全部專案中查找
      const project = this.projects?.find((p) => p.id === projectId);
      return project ? project.name : `專案 ID: ${projectId}`;
    },

    // 確認添加選中的專案
    addSelectedProjects() {
      if (this.selectedProjectIds.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "請先選擇專案",
          text: "請至少選擇一個專案",
        });
        return;
      }

      // 將選中的專案添加到請款單中
      this.selectedProjectIds.forEach((projectId) => {
        // 從 modalProjects 或 projects 中找到專案
        let project = this.modalProjects.find((p) => p.id === projectId);
        if (!project) {
          project = this.projects.find((p) => p.id === projectId);
        }

        if (project) {
          this.payment.payment_projects.push({
            project: projectId,
            project_name: project.name,
            report_name: project.report_name || '', // 加入報告書名稱
            amount: this.projectAmounts[projectId] || 0, // 使用設定的金額或預設為0
            description: this.projectDescriptions[projectId] || "", // 使用設定的描述或預設為空白
            change_count: 0, // 預設變更次數為0
          });
        }
      });

      // 關閉對話框
      this.hideAddProjectModal();

      // 顯示成功訊息
      Swal.fire({
        icon: "success",
        title: "專案新增成功",
        text: `已新增 ${this.selectedProjectIds.length} 個專案`,
        timer: 2000,
        showConfirmButton: false,
      });
    },
    hideAddProjectModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addProjectModal")
      );
      if (modal) {
        modal.hide();
      }
    },

    // 此方法已經在上方定義為 filterProjectsForModal() 的別名，這裡改名為 searchProjectList 以避免重複
    searchProjectList() {
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
          icon: "warning",
          title: "提示",
          text: "請選擇專案",
        });
        return;
      }

      if (!this.newProjectItem.amount || this.newProjectItem.amount <= 0) {
        Swal.fire({
          icon: "warning",
          title: "提示",
          text: "請輸入有效的金額",
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
                icon: "error",
                title: "錯誤",
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
      this.validationErrors = {};
      this.dateErrors = {};
      // 取得請款單第一個專案ID
      const firstProjectId = (this.payment.payment_projects && this.payment.payment_projects.length > 0)
        ? this.payment.payment_projects[0].project
        : '';
      this.newInvoice = {
        id: null,
        invoice_type: "normal",
        invoice_number: "",
        amount: 0,
        tax_amount: 0,
        issue_date: new Date().toISOString().split("T")[0],
        notes: "",
        payment_received_date: null,
        account_entry_date: null,
        payment_method: "",
        actual_received_amount: null,
        gross_amount: 0,
        payment_status: "unpaid",
        is_paid: false,
        project_amounts: [ { project_id: firstProjectId, amount: 0 } ], // 預設為第一個專案id，金額0
      };
      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
      
      // modal 顯示後自動focus到第一個輸入欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          const firstInput = modal._element.querySelector('input, select');
          if (firstInput) {
            firstInput.focus();
          }
        });
      }, { once: true });
    },

    // 顯示編輯發票 Modal
    editInvoice(invoiceId) {
      this.editingInvoice = true;
      this.editingInvoiceId = invoiceId;
      this.validationErrors = {};
      this.dateErrors = {};
      const invoice = this.payment.invoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        // 若有 gross_amount 則帶入，否則自動計算
        const gross = invoice.gross_amount !== undefined ? invoice.gross_amount : (Number(invoice.amount || 0) + Number(invoice.tax_amount || 0));
        this.newInvoice = {
          id: invoice.id,
          invoice_type: invoice.invoice_type || "normal",
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          tax_amount: invoice.tax_amount,
          issue_date: invoice.issue_date,
          payment_received_date: invoice.payment_received_date || "",
          account_entry_date: invoice.account_entry_date || "",
          payment_method: invoice.payment_method || "",
          actual_received_amount: invoice.actual_received_amount || "",
          notes: invoice.notes || "",
          gross_amount: gross,
          payment_status: invoice.payment_status || (invoice.is_paid ? "paid" : "unpaid"),
          is_paid: invoice.is_paid || false,
          project_amounts: invoice.project_amounts && invoice.project_amounts.length > 0 ? invoice.project_amounts : [ { project_id: '', amount: 0 } ],
        };
      }
      const modal = new bootstrap.Modal(
        document.getElementById("addInvoiceModal")
      );
      modal.show();
      
      // modal 顯示後自動focus到第一個輸入欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          const firstInput = modal._element.querySelector('input, select');
          if (firstInput) {
            firstInput.focus();
          }
        });
      }, { once: true });
    },

    // 隱藏發票 Modal
    hideAddInvoiceModal() {
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addInvoiceModal")
      );
      if (modal) {
        modal.hide();
      }
      // 延遲重置表單，確保Modal完全關閉後再清空
      setTimeout(() => {
        this.resetInvoiceForm();
      }, 300);
    },

    // 重置發票表單
    resetInvoiceForm() {
      this.newInvoice = {
        id: null,
        invoice_type: "normal",
        invoice_number: "",
        amount: 0,
        tax_amount: 0,
        issue_date: "",
        notes: "",
        payment_received_date: null,
        account_entry_date: null,
        payment_method: "",
        actual_received_amount: null,
        gross_amount: 0,
        payment_status: "unpaid",
        is_paid: false,
        project_amounts: [ { project_id: '', amount: '' } ],
      };
      this.validationErrors = {};
      this.dateErrors = {};
      this.editingInvoice = false;
      this.editingInvoiceId = null;
    },

    // 新增一筆專案金額
    addProjectAmount() {
      this.newInvoice.project_amounts.push({ project_id: '', amount: 0 });
    },
    // 移除一筆專案金額
    removeProjectAmount(idx) {
      if (this.newInvoice.project_amounts.length > 1) {
        this.newInvoice.project_amounts.splice(idx, 1);
      }
    },

    // 提交發票表單
    submitInvoiceForm() {
      if (!this.validateInvoiceForm()) {
        let errorMessage = '請填寫必填欄位';
        if (Object.keys(this.dateErrors).length > 0) {
          errorMessage += '並檢查日期格式';
        }
        Swal.fire({
          icon: "warning",
          title: "提示",
          text: errorMessage,
        });
        return;
      }
      
      // 驗證 project_amounts 金額
      for (let i = 0; i < this.newInvoice.project_amounts.length; i++) {
        const item = this.newInvoice.project_amounts[i];
        if (item.amount === '') {
          Swal.fire({
            icon: "warning",
            title: "提示",
            text: `專案實收金額 第${i + 1}筆專案金額請輸入正確的金額`,
          });
          return;
        }
      }

      // 檢查是否有專案超出請款金額
      let hasExceededAmount = false;
      for (const item of this.newInvoice.project_amounts) {
        if (item.project_id && item.amount) {
          const project = this.payment.payment_projects.find(
            p => p.project === item.project_id
          );
          
          if (project) {
            // 計算總已收金額（包含當前輸入的金額）
            const totalReceived = this.getProjectInvoiceReceivedAmount(item.project_id);
            const requestAmount = Number(project.amount);
            
            // 如果請款金額為0，跳過檢查
            if (requestAmount > 0 && totalReceived > requestAmount) {
              hasExceededAmount = true;
              // 彈出警告提示
                Swal.fire({
                icon: 'error',
                title: '無法儲存發票',
                html: `
                  <div class="text-start">
                  <p><strong>專案：</strong><strong>${project.project_info ? `${project.project_info.year}${project.project_info.category_code}${project.project_info.project_number}` : ''}</strong> - ${project.project_name}</p>
                  <p><strong>請款金額：</strong>${this.formatCurrency(requestAmount)}</p>
                  <p><strong>發票總共金額：</strong>${this.formatCurrency(totalReceived)}</p>
                  <p class="text-danger"><strong>超出金額：</strong>${this.formatCurrency(totalReceived - requestAmount)}</p>
                  <p class="text-warning">⚠️ 發票總共金額超出請款金額<br />請修改專案請款金額後再儲存發票</p>
                  </div>
                `,
                confirmButtonText: '我知道了',
                width: '500px',
                });
              break;
            }
          }
        }
      }
      
      // 如果有超出金額，阻止表單送出
      if (hasExceededAmount) {
        return;
      }

      // 從 project_amounts 取出 amount 並加總
      const totalProjectAmount = this.newInvoice.project_amounts
        .filter(item => item.project_id && item.amount)
        .reduce((sum, item) => sum + Number(item.amount), 0);

      const filtered_project_amounts = this.newInvoice.project_amounts
        .filter(item => 
          item.project_id !== '' 
          && item.project_id !== null 
          && item.project_id !== undefined 
          && item.amount !== null 
          && item.amount !== undefined
        )

      const invoiceData = {
        invoice_type: this.newInvoice.invoice_type,
        invoice_number: this.newInvoice.invoice_number,
        amount: this.newInvoice.amount,
        tax_amount: this.newInvoice.tax_amount || 0,
        issue_date: this.newInvoice.issue_date,
        notes: this.newInvoice.notes || "",
        payment: this.paymentId,
        payment_received_date: this.newInvoice.payment_received_date || null,
        account_entry_date: this.newInvoice.account_entry_date || null,
        payment_method: this.newInvoice.payment_method || null,
        actual_received_amount: totalProjectAmount, // 使用加總值
        payment_status: this.newInvoice.payment_status,
        is_paid: this.newInvoice.payment_status === 'paid',
        project_amounts: filtered_project_amounts
      };

      // 清空空字串值
      Object.keys(invoiceData).forEach(key => {
        if (invoiceData[key] === '') {
          invoiceData[key] = null;
        }
      });

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
            return response.json().then(errorData => {
              throw new Error(errorData.detail || "發票操作失敗");
            });
          }
          return response.json();
        })
        .then(() => {
          Swal.fire({
            icon: "success",
            title: "成功",
            text: this.editingInvoice ? '發票更新成功！' : '發票新增成功！',
            timer: 1500,
          });
          this.hideAddInvoiceModal();
          this.fetchInvoicesForCurrentPayment(); // 只重新獲取發票
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: error.message,
          });
        });
    },

    // 刪除發票
    deleteInvoice(invoiceId) {
      Swal.fire({
        title: "確定要刪除這張發票嗎？",
        text: "此操作無法復原。",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "確定刪除",
        cancelButtonText: "取消",
        buttonsStyling: true,
        customClass: {
          confirmButton: 'btn btn-danger',
          cancelButton: 'btn btn-secondary'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          fetch(`/crm/api/invoices/${invoiceId}/`, {
            method: "DELETE",
            headers: {
              "X-CSRFToken": document.querySelector('[name="csrfmiddlewaretoken"]').value,
            },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error("刪除失敗");
              }
              Swal.fire({
                icon: "success",
                title: "成功",
                text: "發票刪除成功！",
                timer: 1500,
              });
              this.fetchInvoicesForCurrentPayment(); // 只重新獲取發票
            })
            .catch((error) => {
              console.error("Error:", error);
              Swal.fire({
                icon: "error",
                title: "錯誤",
                text: "刪除失敗",
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
      if (!this.payment.selected_bank_account) {
        Swal.fire({
          icon: "warning",
          title: "未設定匯款帳號",
          html: `請先設定匯款帳號後再匯出Excel。<br><a href="/crm/company/${this.payment.company}/details/" target="_blank" style="color:#3085d6;text-decoration:underline;">前往收款公司設定頁面</a>`,
        });
        return;
      }
      window.location.href = `/crm/payment/${this.paymentId}/export_excel/`;
    },

    // 當公司改變時，獲取該公司的銀行帳戶
    handleCompanyChange() {
      if (this.payment.company) {
        this.fetchBankAccounts(this.payment.company);
      } else {
        // 如果公司被清除，則清空銀行帳號列表和選定的銀行帳戶
        this.bankAccounts = [];
        this.payment.selected_bank_account = null;
        this.payment.selected_bank_account_details = null;
      }
    },

    // 獲取公司的銀行帳戶
    fetchBankAccounts(companyId) {
      this.loadingBankAccounts = true;
      this.bankAccounts = [];
      fetch(`/crm/api/company/${companyId}/bank_accounts/`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法獲取銀行帳號列表");
          }
          return response.json();
        })
        .then((data) => {
          this.bankAccounts = data;
          this.loadingBankAccounts = false;

          // 如果沒有銀行帳號，可以提示使用者
          if (data.length === 0) {
            console.log("此公司沒有設定任何匯款帳號");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          this.loadingBankAccounts = false;
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: "獲取銀行帳號失敗：" + error.message,
          });
        });
    },

    // 處理選擇銀行帳號
    handleBankAccountChange() {
      // 如果選擇了「新增匯款帳號」選項
      if (this.payment.selected_bank_account === "add_new_account") {
        this.openBankAccountModal();
      }
    },

    // 顯示新增銀行帳號對話框
    openBankAccountModal() {
      // 重置表單數據
      this.bankAccountModal = {
        show: true,
        account_name: "",
        account_number: "",
        bank_name: "",
        bank_code: "",
        company: this.payment.company,
      };

      // 使用Bootstrap的Modal顯示對話框
      const modalElement = document.getElementById("addBankAccountModal");
      if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      }
    },

    // 隱藏銀行帳號對話框
    closeBankAccountModal() {
      const modalElement = document.getElementById("addBankAccountModal");
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }

      // 如果選擇的是"新增匯款帳號"但關閉了對話框，重置選擇
      if (this.payment.selected_bank_account === "add_new_account") {
        this.payment.selected_bank_account = null;
      }
    },

    // 提交新銀行帳號表單
    submitBankAccountForm() {
      if (
        !this.bankAccountModal.account_number ||
        !this.bankAccountModal.account_name ||
        !this.bankAccountModal.bank_name ||
        !this.bankAccountModal.bank_code
      ) {
        Swal.fire({
          icon: "error",
          title: "輸入不完整",
          text: "請填寫所有必填欄位",
        });
        return;
      }

      const newBankAccount = {
        company: this.payment.company,
        account_number: this.bankAccountModal.account_number,
        account_name: this.bankAccountModal.account_name,
        bank_name: this.bankAccountModal.bank_name,
        bank_code: this.bankAccountModal.bank_code,
      };

      fetch(`/crm/api/companys/${this.payment.company}/add_bank_account/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector('[name=csrfmiddlewaretoken]').value,
        },
        body: JSON.stringify(newBankAccount),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("新增銀行帳號失敗");
          }
          return response.json();
        })
        .then((data) => {
          // 添加display_text屬性以便在下拉列表中顯示
          data.display_text = `${data.account_name} (${data.bank_name} - ${data.account_number})`;

          // 將新帳號添加到列表中
          this.bankAccounts.push(data);

          // 將新帳號設為選定帳號
          this.payment.selected_bank_account = data.id;
          this.payment.selected_bank_account_details = data;

          // 關閉對話框
          this.closeBankAccountModal();

          Swal.fire({
            icon: "success",
            title: "成功",
            text: "銀行帳號已成功新增",
            timer: 1500,
          });
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: error.message,
          });
        });
    },

    // 四捨五入到整數（模擬 Excel ROUND）
    round(value, digits = 0) {
      const factor = Math.pow(10, digits);
      return Math.round(value * factor) / factor;
    },

    // 當含稅金額變動時自動計算未稅與稅額
    handleGrossAmountChange() {
      const gross = Number(this.newInvoice.gross_amount) || 0;
      const amount = this.round(gross / 1.05, 0);
      const tax = gross - amount;
      this.newInvoice.amount = amount;
      this.newInvoice.tax_amount = tax;
    },
    // 當未稅金額變動時自動計算稅額
    handleAmountChange() {
      const gross = Number(this.newInvoice.gross_amount) || 0;
      const amount = Number(this.newInvoice.amount) || 0;
      const tax = gross - amount;
      this.newInvoice.tax_amount = tax;
    },
    // 當稅額變動時自動計算未稅金額
    handleTaxAmountChange() {
      const gross = Number(this.newInvoice.gross_amount) || 0;
      const tax = Number(this.newInvoice.tax_amount) || 0;
      const amount = gross - tax;
      this.newInvoice.amount = amount;
    },

    // 重新獲取當前請款單的發票
    fetchInvoicesForCurrentPayment() {
      if (!this.paymentId) return;
      return fetch(`/crm/api/invoices/?payment=${this.paymentId}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("無法獲取發票資料");
          }
          return response.json();
        })
        .then((data) => {
          // 支援分頁API或直接回傳陣列
          this.payment.invoices = data.results || data;
        })
        .catch((error) => {
          console.error("Error fetching invoices:", error);
          Swal.fire({
            icon: "error",
            title: "錯誤",
            text: "獲取發票資料失敗：" + error.message,
          });
        });
    },

    // 發票表單驗證
    validateInvoiceForm() {
      this.validationErrors = {};

      // 發票類型必填
      if (!this.newInvoice.invoice_type) {
        this.validationErrors.invoice_type = true;
      }

      // 正常開立發票時的必填欄位
      if (this.newInvoice.invoice_type === 'normal') {
        if (!this.newInvoice.invoice_number) {
          this.validationErrors.invoice_number = true;
        }

        if (!this.newInvoice.amount) {
          this.validationErrors.amount = true;
        }

        if (!this.newInvoice.tax_amount) {
          this.validationErrors.tax_amount = true;
        }

        if (!this.newInvoice.issue_date) {
          this.validationErrors.issue_date = true;
        }
      }

      // 收款日和入帳日不需驗證
      // if (this.newInvoice.invoice_type === 'normal') {
      //   if (!this.newInvoice.payment_received_date) {
      //     this.validationErrors.payment_received_date = '請填寫正確收款日期';
      //   }

      //   if (!this.newInvoice.account_entry_date) {
      //     this.validationErrors.account_entry_date = '請填寫正確入帳日期';
      //   }
      // }

      // 重新驗證所有日期
      this.handleInvoiceDateValidation('issue_date');
      this.handleInvoiceDateValidation('payment_received_date');
      this.handleInvoiceDateValidation('account_entry_date');

      return Object.keys(this.validationErrors).length === 0 && Object.keys(this.dateErrors).length === 0;
    },

    // 驗證日期格式和有效性
    validateDateInput(dateString, fieldName) {
      if (!dateString) {
        delete this.dateErrors[fieldName];
        return true;
      }

      // 檢查基本格式 YYYY-MM-DD
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(dateString)) {
        this.dateErrors[fieldName] = '請輸入正確的日期格式 (YYYY-MM-DD)';
        return false;
      }

      // 檢查年份範圍 (1900-2999)
      const year = parseInt(dateString.substr(0, 4));
      if (year < 1900 || year > 2999) {
        this.dateErrors[fieldName] = '年份必須在 1900-2999 之間';
        return false;
      }

      // 檢查是否為有效日期
      const date = new Date(dateString + 'T00:00:00');
      const inputDateStr = dateString;
      const validDateStr = date.getFullYear() + '-' + 
                          String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(date.getDate()).padStart(2, '0');

      if (inputDateStr !== validDateStr || isNaN(date.getTime())) {
        this.dateErrors[fieldName] = '請輸入有效的日期 (例如: 2025-02-31 不是有效日期)';
        return false;
      }

      delete this.dateErrors[fieldName];
      return true;
    },

    // 驗證日期輸入並檢查邏輯關係
    handleInvoiceDateValidation(fieldName) {
      this.dateWarning[fieldName] = null; // 清除警告訊息
      const value = this.newInvoice[fieldName];
      
      // 先驗證單個日期格式
      if (!this.validateDateInput(value, fieldName)) {
        return;
      }

      // 如果格式正確，再檢查邏輯關係
      if (fieldName === 'payment_received_date' && value) {
        const paymentDate = new Date(value + 'T00:00:00');
        const issueDate = new Date(this.newInvoice.issue_date + 'T00:00:00');
        
        if (this.newInvoice.issue_date && paymentDate < issueDate) {
          this.dateWarning[fieldName] = '收款日期不能早於發票開立日期';
        }
      }

      if (fieldName === 'account_entry_date' && value) {
        const entryDate = new Date(value + 'T00:00:00');
        
        if (this.newInvoice.payment_received_date) {
          const paymentDate = new Date(this.newInvoice.payment_received_date + 'T00:00:00');
          if (entryDate < paymentDate) {
            this.dateWarning[fieldName] = '入帳日期不能早於收款日期';
          }
        }
      }
    },

    // 處理發票類型變更
    handleInvoiceTypeChange() {
      // 當選擇不開發票或發票待開時，設定對應的發票號碼並清空相關欄位
      if (this.newInvoice.invoice_type === 'no_invoice') {
        this.newInvoice.invoice_number = "不開發票";
        this.newInvoice.amount = "";
        this.newInvoice.tax_amount = "";
        this.newInvoice.issue_date = "";
        this.newInvoice.gross_amount = "";
      } else if (this.newInvoice.invoice_type === 'pending') {
        this.newInvoice.invoice_number = "發票待開";
        this.newInvoice.amount = "";
        this.newInvoice.tax_amount = "";
        this.newInvoice.issue_date = "";
        this.newInvoice.gross_amount = "";
      } else if (this.newInvoice.invoice_type === 'normal') {
        // 如果切換回正常開立，清空發票號碼讓用戶自行輸入
        if (this.newInvoice.invoice_number === "不開發票" || this.newInvoice.invoice_number === "發票待開") {
          this.newInvoice.invoice_number = "";
        }
      }
      
      // 清空驗證錯誤
      this.validationErrors = {};
      this.dateErrors = {};
      this.dateWarning = {};
    },

    // 取得發票類型文字
    getInvoiceTypeText(type) {
      switch (type) {
        case 'normal':
          return '正常開立';
        case 'no_invoice':
          return '不開發票';
        case 'pending':
          return '發票待開';
        default:
          return '正常開立';
      }
    },

    // 取得發票類型徽章樣式
    getInvoiceTypeBadgeClass(type) {
      switch (type) {
        case 'normal':
          return 'badge-primary';
        case 'no_invoice':
          return 'badge-secondary';
        case 'pending':
          return 'badge-warning';
        default:
          return 'badge-primary';
      }
    },

    // 取得付款狀態徽章樣式
    getPaymentStatusBadgeClass(invoice) {
      // 使用新的 payment_status 欄位，若沒有則使用 is_paid 作為備用
      const status = invoice.payment_status || (invoice.is_paid ? 'paid' : 'unpaid');
      
      switch (status) {
        case 'paid':
          return 'badge badge-success';
        case 'partially_paid':
          return 'badge badge-warning';
        case 'unpaid':
          return 'badge badge-danger';
        default:
          return 'badge badge-secondary';
      }
    },

    // 取得付款狀態文字
    getPaymentStatusText(invoice) {
      const status = invoice.payment_status || (invoice.is_paid ? 'paid' : 'unpaid');
      
      switch (status) {
        case 'paid':
          return '已付款';
        case 'partially_paid':
          return '付款未完成';
        case 'unpaid':
        default:
          return '未付款';
      }
    },

    // 標記發票為已付款
    async markInvoiceAsPaid(invoiceId) {
      try {
        const response = await fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value
          },
          body: JSON.stringify({
            payment_status: 'paid',
            is_paid: true
          })
        });

        if (!response.ok) throw new Error('操作失敗');

        Swal.fire({
          icon: "success",
          title: "成功",
          text: "已標記為已付款",
          timer: 1500,
        });
        
        this.fetchInvoicesForCurrentPayment();

      } catch (error) {
        console.error('Error marking as paid:', error);
        Swal.fire({
          icon: "error",
          title: "錯誤",
          text: "操作失敗",
        });
      }
    },

    // 標記發票為未付款
    async markInvoiceAsUnpaid(invoiceId) {
      try {
        const response = await fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value
          },
          body: JSON.stringify({
            payment_status: 'unpaid',
            is_paid: false
          })
        });

        if (!response.ok) throw new Error('操作失敗');

        Swal.fire({
          icon: "success",
          title: "成功",
          text: "已標記為未付款",
          timer: 1500,
        });
        
        this.fetchInvoicesForCurrentPayment();

      } catch (error) {
        console.error('Error marking as unpaid:', error);
        Swal.fire({
          icon: "error",
          title: "錯誤",
          text: "操作失敗",
        });
      }
    },

    // 標記發票為付款未完成
    async markInvoiceAsPartiallyPaid(invoiceId) {
      try {
        const response = await fetch(`/crm/api/invoices/${invoiceId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value
          },
          body: JSON.stringify({
            payment_status: 'partially_paid',
            is_paid: false
          })
        });

        if (!response.ok) throw new Error('操作失敗');

        Swal.fire({
          icon: "success",
          title: "成功",
          text: "已標記為付款未完成",
          timer: 1500,
        });
        
        this.fetchInvoicesForCurrentPayment();

      } catch (error) {
        console.error('Error marking as partially paid:', error);
        Swal.fire({
          icon: "error",
          title: "錯誤",
          text: "操作失敗",
        });
      }
    },

    // ========== 收款記錄相關方法 ==========
    getProjectPayments(projectId) {
      // 根據專案ID回傳該專案的收款記錄
      return this.projectReceipts.filter(receipt => receipt.project === projectId);
    },

    getProjectReceivableAmount(projectId) {
      // 計算專案應收金額：從發票中的project_amounts根據專案做加總
      if (!this.payment.invoices || this.payment.invoices.length === 0) {
        return 0;
      }
      
      let totalAmount = 0;
      this.payment.invoices.forEach(invoice => {
        if (invoice.project_amounts && invoice.project_amounts.length > 0) {
          invoice.project_amounts.forEach(projectAmount => {
            if (projectAmount.project_id === projectId) {
              totalAmount += Number(projectAmount.amount || 0);
            }
          });
        }
      });
      
      return totalAmount;
    },

    // 計算專案收款總計
    getProjectPaymentTotal(projectId) {
      // 計算專案的所有收款金額：從projectReceipts中根據專案做加總
      if (!this.projectReceipts || this.projectReceipts.length === 0) {
        return 0;
      }
      
      let totalAmount = 0;
      this.projectReceipts.forEach(receipt => {
        if (receipt.project === projectId) {
          totalAmount += Number(receipt.amount || 0);
        }
      });
      
      return totalAmount;
    },

    // 計算專案已收金額（不包含當前正在輸入的金額）
    getExistingProjectReceived(projectId) {
      if (!projectId || !this.projectReceipts) {
        return 0;
      }
      
      return this.projectReceipts
        .filter(receipt => receipt.project === projectId && (!this.editingProjectReceipt || receipt.id !== this.editingProjectReceiptId))
        .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
    },

    // 計算專案總收款金額（包含當前正在輸入的金額）
    getTotalProjectReceived(projectId) {
      if (!projectId) {
        return 0;
      }
      
      const existingAmount = this.getExistingProjectReceived(projectId);
      const currentAmount = Number(this.newProjectReceipt.amount || 0);
      
      return existingAmount + currentAmount;
    },

    // 檢查專案總已收金額是否超出請款金額
    // 尚未使用
    checkProjectAmountExceed(item) {
      if (!item.project_id) {
        return;
      }
      
      const project = this.payment.payment_projects.find(
        p => p.project === item.project_id
      );
      
      if (project) {
        // 計算總已收金額（包含當前輸入的金額）
        const totalReceived = this.getProjectInvoiceReceivedAmount(item.project_id) + Number(item.amount || 0);
        const requestAmount = Number(project.amount);
        
        if (totalReceived > requestAmount) {
          // 彈出警告提示
          Swal.fire({
            icon: 'warning',
            title: '總已收金額超出警告',
            html: `
              <div class="text-start">
                <p><strong>專案：</strong>${project.project_name}</p>
                <p><strong>請款金額：</strong>${this.formatCurrency(requestAmount)}</p>
                <p><strong>已收金額：</strong>${this.formatCurrency(this.getExistingProjectReceived(item.project_id))}</p>
                <p><strong>本次輸入：</strong>${this.formatCurrency(item.amount || 0)}</p>
                <p class="text-danger"><strong>總已收金額：</strong>${this.formatCurrency(totalReceived)}</p>
                <p class="text-danger"><strong>超收金額：</strong>${this.formatCurrency(totalReceived - requestAmount)}</p>
                <p class="text-warning">⚠️ 總已收金額超出請款金額<br />請至專案明細中修改請款金額</p>
              </div>
            `,
            confirmButtonText: '我知道了',
            width: '500px',
          });
        }
      }
    },

    // 計算特定專案在當前請款單所有發票中的已收金額總和
    getProjectInvoiceReceivedAmount(projectId) {
      let totalReceivedAmount = 0;
      
      // 計算已存在發票中的金額
      if (this.payment.invoices && this.payment.invoices.length > 0) {
        this.payment.invoices.forEach(invoice => {
          if (invoice.project_amounts && invoice.project_amounts.length > 0) {
            invoice.project_amounts.forEach(projectAmount => {
              if (projectAmount.project_id === projectId) {
                // 直接加總該專案在發票中的金額
                totalReceivedAmount += Number(projectAmount.amount || 0);
              }
            });
          }
        });
      }
      
      // 如果是新增發票模式且不是編輯狀態，加上正在輸入的發票金額
      if (!this.editingInvoice && this.newInvoice.project_amounts && this.newInvoice.project_amounts.length > 0) {
        this.newInvoice.project_amounts.forEach(projectAmount => {
          if (projectAmount.project_id === projectId) {
            totalReceivedAmount += Number(projectAmount.amount || 0);
          }
        });
      }
      
      return totalReceivedAmount;
    },

    getTotalProjectPaymentAmount() {
      // 計算所有收款記錄的總金額
      return this.projectReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
    },

    showAddProjectPaymentModal() {
      // 顯示新增收款記錄對話框
      this.resetProjectReceiptForm();
      this.editingProjectReceipt = false;
      
      const modal = new bootstrap.Modal(document.getElementById('addProjectReceiptModal'));
      modal.show();
    },

    hideProjectReceiptModal() {
      // 隱藏收款記錄對話框
      const modal = bootstrap.Modal.getInstance(document.getElementById('addProjectReceiptModal'));
      if (modal) {
        modal.hide();
      }
    },

    editProjectPayment(receiptId) {
      // 編輯收款記錄
      const receipt = this.projectReceipts.find(r => r.id === receiptId);
      if (receipt) {
        this.newProjectReceipt = { ...receipt };
        this.editingProjectReceipt = true;
        this.editingProjectReceiptId = receiptId;
        
        const modal = new bootstrap.Modal(document.getElementById('addProjectReceiptModal'));
        modal.show();
      }
    },

    async deleteProjectPayment(receiptId) {
      // 刪除收款記錄
      try {
        const result = await Swal.fire({
          title: "確認刪除",
          text: "您確定要刪除這筆收款記錄嗎？",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#3085d6",
          confirmButtonText: "刪除",
          cancelButtonText: "取消",
        });

        if (result.isConfirmed) {
          const response = await fetch(`/crm/api/project-receipts/${receiptId}/`, {
            method: 'DELETE',
            headers: {
              'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value,
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // 從本地列表移除
          this.projectReceipts = this.projectReceipts.filter(r => r.id !== receiptId);
          
          Swal.fire({
            icon: "success",
            title: "刪除成功",
            timer: 1500,
          });
        }
      } catch (error) {
        console.error('Error deleting receipt:', error);
        Swal.fire({
          icon: "error",
          title: "刪除失敗",
          text: "刪除收款記錄時發生錯誤",
        });
      }
    },

    async saveProjectReceipt() {
      // 儲存收款記錄
      try {
        // 驗證基本資料
        if (!this.newProjectReceipt.project) {
          Swal.fire({
            icon: "warning",
            title: "提示",
            text: "請選擇專案",
          });
          return;
        }

        if (!this.newProjectReceipt.amount || this.newProjectReceipt.amount <= 0) {
          Swal.fire({
            icon: "warning",
            title: "提示",
            text: "請輸入有效的收款金額",
          });
          return;
        }

        // 檢查是否超收
        const projectReceivableAmount = this.getProjectReceivableAmount(this.newProjectReceipt.project);
        const totalReceived = this.getTotalProjectReceived(this.newProjectReceipt.project);
        
        if (totalReceived > projectReceivableAmount) {
          
          Swal.fire({
            icon: 'error',
            title: '無法儲存收款記錄',
            html: `
              <div class="text-start">
                <p><strong>發票金額：</strong>${this.formatCurrency(projectReceivableAmount)}</p>
                <p><strong>已收金額：</strong>${this.formatCurrency(this.getExistingProjectReceived(this.newProjectReceipt.project))}</p>
                <p><strong>本次收款：</strong>${this.formatCurrency(this.newProjectReceipt.amount)}</p>
                <p class="text-danger"><strong>總收款金額：</strong>${this.formatCurrency(totalReceived)}</p>
                <p class="text-danger"><strong>超收金額：</strong>${this.formatCurrency(totalReceived - projectReceivableAmount)}</p>
                <p class="text-warning">⚠️ 收款金額超出發票金額<br />請修改收款金額後再儲存</p>
              </div>
            `,
            confirmButtonText: '我知道了',
            width: '500px',
          });
          return;
        }

        const receiptData = {
          ...this.newProjectReceipt,
          payment: this.paymentId,
        };

        let response;
        if (this.editingProjectReceipt) {
          // 更新
          response = await fetch(`/crm/api/project-receipts/${this.editingProjectReceiptId}/`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value,
            },
            body: JSON.stringify(receiptData)
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          const index = this.projectReceipts.findIndex(r => r.id === this.editingProjectReceiptId);
          if (index !== -1) {
            this.projectReceipts[index] = data;
          }
          
          // 暫存檢查結果，稍後處理
          const completionCheck = data.payment_completion_check;
          
          this.resetProjectReceiptForm();
          this.hideProjectReceiptModal();
          
          Swal.fire({
            icon: "success",
            title: "更新成功",
            timer: 1500,
          }).then(() => {
            // 在成功訊息關閉後檢查請款完成狀態
            if (completionCheck) {
              setTimeout(() => {
                this.handlePaymentCompletionCheck(completionCheck);
              }, 100);
            }
          });
        } else {
          // 新增
          response = await fetch('/crm/api/project-receipts/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value,
            },
            body: JSON.stringify(receiptData)
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          this.projectReceipts.push(data);
          
          // 暫存檢查結果，稍後處理
          const completionCheck = data.payment_completion_check;
          
          this.resetProjectReceiptForm();
          this.hideProjectReceiptModal();
          
          Swal.fire({
            icon: "success",
            title: "新增成功",
            timer: 1500,
          }).then(() => {
            // 在成功訊息關閉後檢查請款完成狀態
            if (completionCheck) {
              console.log('新增模式-在Swal關閉後檢查結果:', completionCheck);
              setTimeout(() => {
                this.handlePaymentCompletionCheck(completionCheck);
              }, 100);
            }
          });
        }

      } catch (error) {
        console.error('Error saving receipt:', error);
        Swal.fire({
          icon: "error",
          title: "儲存失敗",
          text: "儲存收款記錄時發生錯誤",
        });
      }
    },

    resetProjectReceiptForm() {
      // 重置收款記錄表單
      this.newProjectReceipt = {
        id: null,
        project: null,
        amount: null,
        payment_date: null,
        payment_method: "",
      };
      this.editingProjectReceipt = false;
      this.editingProjectReceiptId = null;
    },

    async fetchProjectReceipts() {
      // 載入收款記錄
      try {
        const response = await fetch(`/crm/api/project-receipts/?payment=${this.paymentId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.projectReceipts = data.results || data || [];
      } catch (error) {
        console.error('Error fetching project receipts:', error);
        // 確保即使出錯也有空陣列
        this.projectReceipts = [];
      }
    },

    // ========== 請款完成狀態檢查相關方法 ==========
    async checkPaymentCompletion() {
      /**
       * 檢查請款完成狀態
       */
      try {
        const response = await fetch(`/crm/api/payments/${this.paymentId}/check_payment_completion/`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        this.handlePaymentCompletionCheck(data);
      } catch (error) {
        console.error('Error checking payment completion:', error);
      }
    },

    handlePaymentCompletionCheck(checkResult) {
      /**
       * 處理請款完成狀態檢查結果
       */
      console.log('handlePaymentCompletionCheck called with:', checkResult);
      console.log('is_completed:', checkResult.is_completed);
      console.log('already_marked:', checkResult.already_marked);
      console.log('Condition result:', checkResult.is_completed && !checkResult.already_marked);
      
      if (checkResult.is_completed && !checkResult.already_marked) {
        // 請款已完成但尚未標記，顯示確認對話框
        console.log('Showing payment completion modal');
        this.showPaymentCompletionModal();
      } else {
        console.log('Not showing modal - condition not met');
      }
    },

    showPaymentCompletionModal() {
      /**
       * 顯示請款完成確認對話框
       */
      Swal.fire({
        title: '請款已完成',
        text: '所有專案的請款金額、發票金額與收款記錄金額均已匹配。是否要將此請款單標記為完成？',
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#198754',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '是，標記為完成',
        cancelButtonText: '稍後再說',
        allowOutsideClick: false
      }).then((result) => {
        if (result.isConfirmed) {
          this.markPaymentAsCompleted();
        }
      });
    },

    async markPaymentAsCompleted() {
      /**
       * 標記請款單為完成
       */
      try {
        const response = await fetch(`/crm/api/payments/${this.paymentId}/mark_as_completed/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name="csrfmiddlewaretoken"]').value,
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 更新本地資料
        this.payment.paid = true;
        this.payment.payment_date = data.payment_date;
        
        Swal.fire({
          icon: 'success',
          title: '請款單已完成',
          text: `完成日期：${data.payment_date}`,
          timer: 2000
        });

      } catch (error) {
        console.error('Error marking payment as completed:', error);
        Swal.fire({
          icon: 'error',
          title: '標記失敗',
          text: error.message || '標記請款單為完成時發生錯誤',
        });
      }
    },
  },
  mounted() {
    // 初始化陣列確保不會有 undefined 錯誤
    if (!this.modalProjects) this.modalProjects = [];
    if (!this.selectedProjectIds) this.selectedProjectIds = [];
    if (!this.projectReceipts) this.projectReceipts = [];
    if (!this.paymentDocuments) this.paymentDocuments = [];
    if (!this.owners) this.owners = [];
    if (!this.companys) this.companys = [];
    if (!this.categories) this.categories = [];
    if (!this.availableYears) this.availableYears = [];
    if (!this.bankAccounts) this.bankAccounts = [];

    // 從URL獲取payment ID
    const pathParts = window.location.pathname.split("/");
    this.paymentId = pathParts[pathParts.indexOf("payment") + 1]; 
    
    // 獲取基本資料 - 移除專案列表的載入
    this.fetchPaymentDetails().then(() => {
      // 頁面載入完成後檢查請款完成狀態
      this.checkPaymentCompletion();
    });
    
    this.fetchOwners(); // 新增：獲取業主列表
    this.fetchCompanys(); // 新增：獲取公司列表
    this.fetchPaymentDocuments(); // 新增：獲取內存請款單檔案列表
    this.fetchCategories(); // 新增：獲取類別列表
    this.fetchYears(); // 新增：獲取可用年份
    
    // 頁面載入後自動focus到搜尋欄位
    this.$nextTick(() => {
      if (this.$refs.projectSearchInput) {
        this.$refs.projectSearchInput.focus();
      }
    });
    
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
  
  unmounted() {
    // 清理計時器
    if (this.projectSearchTimeout) {
      clearTimeout(this.projectSearchTimeout);
    }
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
