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
      pageSize: 5, // 每頁顯示的項目數，可調整
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
  methods: {
    deleteOwner(ownerId) {
      if (confirm("確定要刪除此業主嗎？")) {
        fetch(`/crm/api/owners/${ownerId}/`, {
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
            this.fetchOwners(this.currentPage); // 重新獲取當前頁數據
            this.activeMenu = null;
          })
          .catch((error) => console.error("無法刪除:", error));
      }
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
          if (!response.ok)
            throw new Error(this.isEditMode ? "更新業主失敗" : "創建業主失敗");
          return response.json();
        })
        .then(() => {
          this.hideAddOwnerModal(); // 提交成功後關閉 Modal
          this.fetchOwners(this.currentPage); // 刷新業主列表
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(
            this.isEditMode
              ? "更新業主失敗，請稍後再試"
              : "創建業主失敗，請稍後再試"
          );
        });
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
