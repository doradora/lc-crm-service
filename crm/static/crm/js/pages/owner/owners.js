const ownerList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      owners: [],
      isLoading: false,
      searchQuery: "",
      activeMenu: null,
      currentPage: 1,
      totalPages: 1,
      pageSize: 10, // 修改默認值，從5改為10
      menuPosition: {
        x: 0,
        y: 0,
      },
      showModal: false,
      isEditMode: false,
      editOwnerId: null,
      newOwner: {
        company_name: "",
        tax_id: "",
        phone: "",
        fax: "",
        email: "",
        mobile: "",
        address: "",
        contact_person: "",
      },
    };
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
    deleteOwner(ownerId) {
      Swal.fire({
        title: "確定要刪除此業主嗎？",
        text: "此操作無法還原，請確認是否刪除。",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "確認刪除",
        cancelButtonText: "取消",
      }).then((result) => {
        if (result.isConfirmed) {
          fetch(`/crm/api/owners/${ownerId}/`, {
            method: "DELETE",
            headers: {
              "X-CSRFToken": document.querySelector(
                '[name="csrfmiddlewaretoken"]'
              ).value,
            },
          })
            .then((response) => {
              if (response.ok) {
                return; // 成功，繼續 .then鏈
              }
              // 失敗，讀取錯誤訊息並拋出
              return response.json().then((errorData) => {
                throw new Error(errorData.error || "刪除失敗");
              });
            })
            .then(() => {
              Swal.fire({
                title: "成功!",
                text: "業主已成功刪除。",
                icon: "success",
                confirmButtonText: "確認",
              }).then(() => {
                this.fetchOwners(this.currentPage);
                this.activeMenu = null;
              });
            })
            .catch((error) => {              
              Swal.fire({
                title: "操作失敗",
                text: error,
                icon: "error",
                confirmButtonText: "確認",
              });
            });
        }
      });
    },
    editOwner(owner) {
      // 設置編輯模式
      this.isEditMode = true;
      this.editOwnerId = owner.id;

      // 填充表單數據
      this.newOwner = { ...owner };

      // 顯示模態框
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addOwnerModal")
      );
      modal.show();

      // 關閉下拉選單
      this.activeMenu = null;
    },
    viewProjects(ownerId) {
      // 導航到該業主的專案列表頁面
      window.location.href = `/crm/owner/${ownerId}/projects/`;

      // 關閉下拉選單
      this.activeMenu = null;
    },
    fetchOwners(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/owners/?format=json&page=${page}&page_size=${this.pageSize}`;

      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.owners = data.results; // 假設後端返回 { results: [], count: X }
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching owners:", error))
        .finally(() => {
          this.isLoading = false; // 無論成功或失敗，都將載入狀態設為 false
        });
    },
    toggleMenu(ownerId) {
      if (this.activeMenu === ownerId) {
        this.activeMenu = null;
      } else {
        // 計算位置
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120, // 向左偏移 120px
          y: rect.bottom + 10, // 向下偏移 10px
        };
        this.activeMenu = ownerId;
      }
      event.stopPropagation();
    },
    showAddOwnerModal() {
      this.showModal = true;
      this.isEditMode = false;
      this.editOwnerId = null;
      this.newOwner = {
        company_name: "",
        tax_id: "",
        phone: "",
        fax: "",
        email: "",
        mobile: "",
        address: "",
        contact_person: "",
      };
      // 使用 Bootstrap 的 Modal API 顯示
      const modal = new bootstrap.Modal(
        document.getElementById("addOwnerModal")
      );
      modal.show();
    },
    getMenuStyle(ownerId) {
      if (this.activeMenu !== ownerId) {
        return { display: "none" };
      }
      return {
        "z-index": "107",
        position: "fixed",
        inset: "0px auto auto 0px",
        margin: "0px",
        transform: `translate(${this.menuPosition.x}px, ${this.menuPosition.y}px)`,
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
    hideAddOwnerModal() {
      this.showModal = false;
      // 重置表單數據
      this.newOwner = {
        company_name: "",
        tax_id: "",
        phone: "",
        fax: "",
        email: "",
        mobile: "",
        address: "",
        contact_person: "",
      };
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addOwnerModal")
      );
      modal.hide();
    },
    submitOwnerForm() {
      // 業主資料表單提交
      const url = this.isEditMode
        ? `/crm/api/owners/${this.editOwnerId}/`
        : "/crm/api/owners/";
      const method = this.isEditMode ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(this.newOwner),
      })
        .then((response) => {
          // 無論成功失敗都先讀取 JSON 響應
          return response.json().then((data) => {
            // 將原始響應和數據一起傳遞
            return { status: response.status, ok: response.ok, data: data };
          });
        })
        .then((result) => {
          if (!result.ok) {
            let errorDetails = [];
            Object.keys(result.data).forEach((key) => {
              // 根據欄位給予不同錯誤訊息
              if (key === "tax_id") {
                errorDetails.push("統一編號錯誤，可能已經重複或有誤。");
              } else if (key === "email") {
                errorDetails.push("Email 格式錯誤或已存在。");
              } else {
                // 其他欄位錯誤
                errorDetails.push(`${key}: ${result.data[key]}`);
              }
            });
            const errorMsg = errorDetails.join("\n");
            Swal.fire({
              title: "錯誤!",
              text: errorMsg,
              icon: "error",
              confirmButtonText: "確認",
            });
            // 錯誤時直接 return，不進行後續操作
            return Promise.reject(new Error(errorMsg));
          } else if (result.status === 201) {
            Swal.fire({
              title: "成功!",
              text: "業主新增成功！",
              icon: "success",
              confirmButtonText: "確認",
            });
          } else if (result.status === 200) {
            Swal.fire({
              title: "成功!",
              text: "業主編輯成功！",
              icon: "success",
              confirmButtonText: "確認",
            });
          }
        })
        .then(() => {
          // 只有成功時才會執行
          this.hideAddOwnerModal();
          this.fetchOwners(this.currentPage);
        })
        .catch((error) => {
          // 已在上方顯示過錯誤訊息，這裡可選擇不再顯示
          // 或保留以防萬一
          if (error && error.message) {
            Swal.fire({
              title: "錯誤!",
              text: error.message,
              icon: "error",
              confirmButtonText: "確認",
            });
          }
        });
    },
    // 處理每頁數量變更
    pageSizeChanged() {
      this.currentPage = 1; // 更改每頁數量時重置為第一頁
      this.fetchOwners(1);
    },
  },
  mounted() {
    this.fetchOwners();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    // 組件銷毀時，移除事件監聽器以避免記憶體洩漏
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
