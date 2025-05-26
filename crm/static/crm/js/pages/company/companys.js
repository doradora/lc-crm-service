const companyList = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      companys: [],
      isLoading: false,
      searchQuery: "",
      activeMenu: null,
      currentPage: 1,
      totalPages: 1,
      pageSize: 10,
      menuPosition: {
        x: 0,
        y: 0,
      },
      showModal: false,
      isEditMode: false,
      editCompanyId: null,
      newCompany: {
        name: "",
        tax_id: "",
        phone: "",
        fax: "",
        responsible_person: "",
        address: "",
        contact_person: "",
      },
    };
  },
  computed: {
    displayedPages() {
      const total = this.totalPages;
      const current = this.currentPage;
      const delta = 2;
      let pages = [];

      for (let i = 1; i <= total; i++) {
        if (
          i === 1 ||
          i === total ||
          (i >= current - delta && i <= current + delta)
        ) {
          pages.push(i);
        }
      }

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
    deleteCompany(companyId) {
      Swal.fire({
        title: "確定要刪除此公司嗎？",
        text: "此操作無法復原",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "確定",
        cancelButtonText: "取消"
      }).then((result) => {
        if (result.isConfirmed) {
          fetch(`/crm/api/companys/${companyId}/`, {
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
              this.fetchCompanys(this.currentPage);
              this.activeMenu = null;
              Swal.fire({
                title: "成功!",
                text: "公司已刪除",
                icon: "success",
                confirmButtonText: "確認"
              });
            })
            .catch((error) => {
              console.error("無法刪除:", error);
              Swal.fire({
                title: "錯誤!",
                text: "刪除失敗",
                icon: "error",
                confirmButtonText: "確認"
              });
            });
        }
      });
    },
    editCompany(company) {
      this.isEditMode = true;
      this.editCompanyId = company.id;
      this.newCompany = { ...company };
      this.showModal = true;
      const modal = new bootstrap.Modal(
        document.getElementById("addCompanyModal")
      );
      modal.show();
      this.activeMenu = null;
    },
    fetchCompanys(page = 1) {
      this.currentPage = page;
      this.isLoading = true;
      let url = `/crm/api/companys/?format=json&page=${page}&page_size=${this.pageSize}`;

      if (this.searchQuery) {
        url += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          this.companys = data.results;
          this.totalPages = Math.ceil(data.count / this.pageSize);
        })
        .catch((error) => console.error("Error fetching companys:", error))
        .finally(() => {
          this.isLoading = false;
        });
    },
    toggleMenu(companyId) {
      if (this.activeMenu === companyId) {
        this.activeMenu = null;
      } else {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        this.menuPosition = {
          x: rect.right - 120,
          y: rect.bottom + 10,
        };
        this.activeMenu = companyId;
      }
      event.stopPropagation();
    },
    showAddCompanyModal() {
      this.showModal = true;
      this.isEditMode = false;
      this.editCompanyId = null;
      this.newCompany = {
        name: "",
        tax_id: "",
        phone: "",
        fax: "",
        responsible_person: "",
        address: "",
        contact_person: "",
      };
      const modal = new bootstrap.Modal(
        document.getElementById("addCompanyModal")
      );
      modal.show();
    },
    getMenuStyle(companyId) {
      if (this.activeMenu !== companyId) {
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
    hideAddCompanyModal() {
      this.showModal = false;
      this.newCompany = {
        name: "",
        tax_id: "",
        phone: "",
        fax: "",
        responsible_person: "",
        address: "",
        contact_person: "",
      };
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addCompanyModal")
      );
      modal.hide();
    },
    submitCompanyForm() {
      const url = this.isEditMode
        ? `/crm/api/companys/${this.editCompanyId}/`
        : "/crm/api/companys/";
      const method = this.isEditMode ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document.querySelector(
            'input[name="csrfmiddlewaretoken"]'
          ).value,
        },
        body: JSON.stringify(this.newCompany),
      })
        .then((response) => {
          return response.json().then((data) => {
            return { status: response.status, ok: response.ok, data: data };
          });
        })
        .then((result) => {
          if (!result.ok) {
            let errorDetails = [];
            Object.keys(result.data).forEach((key) => {
              console.log(result.data[key]);
              if (key === "tax_id") {
                errorDetails.push("統一編號錯誤，可能已經重複或有誤。");
              }
            });
            if (errorDetails.length > 0) {
              errorMsg = errorDetails.join("\n");
            }
            throw new Error(errorMsg);
          } else if (result.status === 201) {
            Swal.fire({
              title: "成功!",
              text: "公司新增成功！",
              icon: "success",
              confirmButtonText: "確認",
            });
          } else if (result.status === 200) {
            Swal.fire({
              title: "成功!",
              text: "公司編輯成功！",
              icon: "success",
              confirmButtonText: "確認",
            });
          }
        })
        .then(() => {
          this.hideAddCompanyModal();
          this.fetchCompanys(this.currentPage);
        })
        .catch((error) => {
          Swal.fire({
            title: "錯誤!",
            text: error.message,
            icon: "error",
            confirmButtonText: "確認",
          });
        });
    },
    pageSizeChanged() {
      this.currentPage = 1;
      this.fetchCompanys(1);
    },
  },
  mounted() {
    this.fetchCompanys();
    document.addEventListener("click", this.handleClickOutside);
  },
  unmounted() {
    document.removeEventListener("click", this.handleClickOutside);
  },
}).mount("#app_main");
