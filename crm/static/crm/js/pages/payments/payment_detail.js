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
      projects: [],
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
      },
      editingInvoice: false,
      editingInvoiceId: null,
      // 新增表單驗證相關
      validationErrors: {},
      dateErrors: {}, // 新增日期錯誤狀態
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
      // 專案報告書名稱映射表 - 用於編輯時暫存
      projectReportNames: {}, // 專案ID -> 報告書名稱的映射
      // 內存請款單相關資料
      paymentDocuments: [], // 內存請款單文件列表
      isUploadingDocument: false, // 上傳狀態
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

    // 獲取所有專案，用於編輯時選擇
    fetchProjects() {
      fetch("/crm/api/projects/?format=json&page_size=1000")
        .then((response) => response.json())
        .then((data) => {
          this.projects = data.results;
          // 初始化專案報告書名稱映射
          this.initializeProjectReportNames();
        })
        .catch((error) => console.error("Error fetching projects:", error));
    },

    // 初始化專案報告書名稱映射
    initializeProjectReportNames() {
      this.projects.forEach(project => {
        this.projectReportNames[project.id] = project.report_name || '';
      });
    },

    // 獲取專案的報告書名稱
    getProjectReportName(projectId) {
      if (!projectId) return '';
      return this.projectReportNames[projectId] || '';
    },    // 更新專案的報告書名稱
    updateProjectReportName(projectId, reportName) {
      if (projectId) {
        this.projectReportNames[projectId] = reportName;
      }
    },

    // 批量更新所有已修改專案的報告書名稱
    updateProjectReportNames() {
      const updatePromises = [];

      // 僅針對報告書名稱有變更的專案進行處理
      this.projects.forEach((project) => {
        const updatedReportName = this.projectReportNames[project.id];
        if (updatedReportName && project.report_name !== updatedReportName) {
          // 如果報告書名稱有變更，發送PATCH請求更新
          updatePromises.push(
            fetch(`/crm/api/projects/${project.id}/`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": document.querySelector(
                  '[name="csrfmiddlewaretoken"]'
                ).value,
              },
              body: JSON.stringify({
                report_name: updatedReportName,
              }),
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

        if (!item.amount || item.amount <= 0) {
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
      
      // modal 顯示後自動focus到搜尋欄位
      modal._element.addEventListener('shown.bs.modal', () => {
        this.$nextTick(() => {
          if (this.$refs.projectSearchInput) {
            this.$refs.projectSearchInput.focus();
          }
        });
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
      };
      this.validationErrors = {};
      this.dateErrors = {};
      this.editingInvoice = false;
      this.editingInvoiceId = null;
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
        actual_received_amount: this.newInvoice.actual_received_amount || null,
        payment_status: this.newInvoice.payment_status,
        is_paid: this.newInvoice.payment_status === 'paid',
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

      // 收款日和入帳日必填驗證（除了不開發票的情況）
      if (this.newInvoice.invoice_type === 'normal') {
        if (!this.newInvoice.payment_received_date) {
          this.validationErrors.payment_received_date = '請填寫正確收款日期';
        }

        if (!this.newInvoice.account_entry_date) {
          this.validationErrors.account_entry_date = '請填寫正確入帳日期';
        }
      }

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
          this.dateErrors[fieldName] = '收款日期不能早於發票開立日期';
        }
      }

      if (fieldName === 'account_entry_date' && value) {
        const entryDate = new Date(value + 'T00:00:00');
        
        if (this.newInvoice.payment_received_date) {
          const paymentDate = new Date(this.newInvoice.payment_received_date + 'T00:00:00');
          if (entryDate < paymentDate) {
            this.dateErrors[fieldName] = '入帳日期不能早於收款日期';
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
  },
  mounted() {    // 從URL獲取payment ID
    const pathParts = window.location.pathname.split("/");
    this.paymentId = pathParts[pathParts.indexOf("payment") + 1]; 
    
    // 獲取資料
    Promise.all([
      this.fetchPaymentDetails(),
      this.fetchProjects(),
    ])
      .then(() => {
        // 當付款詳情和專案列表都載入完成後，初始化報告書名稱映射
        this.initializeProjectReportNames();
      });
    this.fetchOwners(); // 新增：獲取業主列表
    this.fetchCompanys(); // 新增：獲取公司列表
    this.fetchPaymentDocuments(); // 新增：獲取內存請款單檔案列表
    
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
