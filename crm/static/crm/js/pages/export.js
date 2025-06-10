const exportApp = createApp({
  delimiters: ["[[", "]]"],
  data() {
    return {
      isLoading: false,
      exportHistory: [],
      activeMenu: null
    };
  },
  methods: {
    /**
     * 取得年份選項（2000~今年）
     */
    getYearOptions() {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let y = currentYear; y >= 2000; y--) {
        years.push(y);
      }
      return years;
    },

    /**
     * 彈出年份選擇 Swal，回傳 {year_start, year_end} 或 null
     */
    async selectYearRange() {
      const years = this.getYearOptions();
      const yearOptions = years.map(y => `<option value='${y}'>${y}</option>`).join('');
      const { value: formValues } = await Swal.fire({
        title: '選擇匯出年份區間',
        html:
          `<div class='mb-2'>\n` +
          `<label>開始年份</label>\n` +
          `<select id='swal-year-start' class='swal2-input'><option value=''>開始年份</option>${yearOptions}</select>\n` +
          `</div>\n` +
          `<div class='mb-2'>\n` +
          `<label>結束年份</label>\n` +
          `<select id='swal-year-end' class='swal2-input'><option value=''>結束年份</option>${yearOptions}</select>\n` +
          `</div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '匯出',
        cancelButtonText: '取消',
        preConfirm: () => {
          const year_start = document.getElementById('swal-year-start').value;
          const year_end = document.getElementById('swal-year-end').value;
          if (year_start && year_end && parseInt(year_start) > parseInt(year_end)) {
            Swal.showValidationMessage('開始年份不能大於結束年份');
            return false;
          }
          return { year_start, year_end };
        }
      });
      if (!formValues) return null;
      if (!formValues.year_start && !formValues.year_end) return {}; // 全部
      return formValues;
    },

    /**
     * 匯出專案資料
     */
    async exportProjects() {
      try {
        const yearRange = await this.selectYearRange();
        if (yearRange === null) return;
        this.isLoading = true;
        let url = '/crm/export/projects/csv/';
        if (yearRange.year_start || yearRange.year_end) {
          const params = [];
          if (yearRange.year_start) params.push(`year_start=${yearRange.year_start}`);
          if (yearRange.year_end) params.push(`year_end=${yearRange.year_end}`);
          url += '?' + params.join('&');
        }
        await this.downloadFile(url);
        this.showSuccessMessage('專案資料匯出成功');
      } catch (error) {
        this.showErrorMessage('專案資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出業主資料
     */
    async exportOwners() {
      try {
        // 不再彈出年份選擇
        this.isLoading = true;
        let url = '/crm/export/owners/csv/';
        await this.downloadFile(url);
        this.showSuccessMessage('業主資料匯出成功');
      } catch (error) {
        this.showErrorMessage('業主資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出請款資料
     */
    async exportPayments() {
      try {
        const yearRange = await this.selectYearRange();
        if (yearRange === null) return;
        this.isLoading = true;
        let url = '/crm/export/payments/csv/';
        if (yearRange.year_start || yearRange.year_end) {
          const params = [];
          if (yearRange.year_start) params.push(`year_start=${yearRange.year_start}`);
          if (yearRange.year_end) params.push(`year_end=${yearRange.year_end}`);
          url += '?' + params.join('&');
        }
        await this.downloadFile(url);
        this.showSuccessMessage('請款資料匯出成功');
      } catch (error) {
        this.showErrorMessage('請款資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出發票資料
     */
    async exportInvoices() {
      try {
        const yearRange = await this.selectYearRange();
        if (yearRange === null) return;
        this.isLoading = true;
        let url = '/crm/export/invoices/csv/';
        if (yearRange.year_start || yearRange.year_end) {
          const params = [];
          if (yearRange.year_start) params.push(`year_start=${yearRange.year_start}`);
          if (yearRange.year_end) params.push(`year_end=${yearRange.year_end}`);
          url += '?' + params.join('&');
        }
        await this.downloadFile(url);
        this.showSuccessMessage('發票資料匯出成功');
      } catch (error) {
        this.showErrorMessage('發票資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出案件類別資料
     */
    async exportCategories() {
      try {
        // 不再彈出年份選擇
        this.isLoading = true;
        let url = '/crm/export/categories/csv/';
        await this.downloadFile(url);
        this.showSuccessMessage('案件類別資料匯出成功');
      } catch (error) {
        this.showErrorMessage('案件類別資料匯出失敗', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 匯出所有資料
     */
    async exportAll() {
      try {
        const yearRange = await this.selectYearRange();
        if (yearRange === null) return;
        this.isLoading = true;
        const exportTasks = [
          { method: this.exportProjects, name: '專案資料', url: '/crm/export/projects/csv/' },
          { method: this.exportOwners, name: '業主資料', url: '/crm/export/owners/csv/' },
          { method: this.exportPayments, name: '請款資料', url: '/crm/export/payments/csv/' },
          { method: this.exportInvoices, name: '發票資料', url: '/crm/export/invoices/csv/' },
          { method: this.exportCategories, name: '案件類別資料', url: '/crm/export/categories/csv/' }
        ];
        // Swal 進度條
        let current = 0;
        await Swal.fire({
          title: '綜合報表匯出中',
          html: `<div id='export-progress-text'>準備中...</div><div class='progress mt-3' style='height:24px;'><div id='export-progress-bar' class='progress-bar progress-bar-striped progress-bar-animated' role='progressbar' style='width: 0%'>0%</div></div>`,
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: async () => {
            const bar = document.getElementById('export-progress-bar');
            const text = document.getElementById('export-progress-text');
            for (let i = 0; i < exportTasks.length; i++) {
              const task = exportTasks[i];
              text.innerHTML = `正在匯出：<b>${task.name}</b> (${i+1}/${exportTasks.length})`;
              let url = task.url;
              // 只有專案/請款/發票才帶年份
              if ([0,2,3].includes(i) && (yearRange.year_start || yearRange.year_end)) {
                const params = [];
                if (yearRange.year_start) params.push(`year_start=${yearRange.year_start}`);
                if (yearRange.year_end) params.push(`year_end=${yearRange.year_end}`);
                url += '?' + params.join('&');
              }
              await this.downloadFile(url);
              current = Math.round(((i+1)/exportTasks.length)*100);
              bar.style.width = current + '%';
              bar.innerText = current + '%';
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            text.innerHTML = '所有資料匯出完成！';
            bar.classList.remove('progress-bar-animated');
            bar.classList.add('bg-success');
            setTimeout(() => Swal.close(), 1200);
          }
        });
        this.showSuccessMessage('所有資料匯出完成');
      } catch (error) {
        this.showErrorMessage('匯出過程中發生錯誤', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 下載檔案的通用方法
     */
    async downloadFile(url) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 取得檔案名稱（如果有的話）
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `export_${new Date().toISOString().split('T')[0]}.csv`;
        
        if (contentDisposition) {
          // 首先嘗試解析 UTF-8 編碼的檔案名稱
          const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
          if (utf8Match) {
            try {
              filename = decodeURIComponent(utf8Match[1]);
            } catch (e) {
              console.warn('Failed to decode UTF-8 filename:', e);
            }
          } else {
            // 如果沒有 UTF-8 編碼，則使用標準的 filename
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch) {
              filename = filenameMatch[1].replace(/['"]/g, '');
            }
          }
        }

        const blob = await response.blob();
        
        // 創建下載連結
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        return response;
      } catch (error) {
        console.error('Download error:', error);
        throw error;
      }
    },



    /**
     * 顯示成功訊息
     */
    showSuccessMessage(message) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: '匯出成功',
          text: message,
          timer: 3000,
          showConfirmButton: false
        });
      } else {
        alert(message);
      }
    },

    /**
     * 顯示錯誤訊息
     */
    showErrorMessage(message, error) {
      console.error(message, error);
      const errorText = error?.message || error || '未知錯誤';
      
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: '匯出失敗',
          text: `${message}: ${errorText}`,
          confirmButtonText: '確定'
        });
      } else {
        alert(`${message}: ${errorText}`);
      }
    }
  },

  mounted() {
    console.log('Export app mounted');
  }
});

// 掛載 Vue 應用到正確的容器
exportApp.mount('#export_list');
