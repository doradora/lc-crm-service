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
     * 取得月份選項（1-12月）
     */
    getMonthOptions() {
      const months = [];
      for (let m = 1; m <= 12; m++) {
        months.push({ value: m.toString().padStart(2, '0'), text: `${m}月` });
      }
      return months;
    },

    /**
     * 彈出年份區間選擇 Swal，回傳 {year_start, year_end, select_all} 或 null
     */
    async selectYearRange() {
      const years = this.getYearOptions();
      const yearOptions = years.map(y => `<option value='${y}'>${y}</option>`).join('');
      
      const { value: formValues } = await Swal.fire({
        title: '選擇年份區間',
        html:
          `<div class='mb-3'>\n` +
          `<label class='form-check-label'>\n` +
          `<input type='checkbox' id='swal-select-all' class='form-check-input me-2' checked>\n` +
          `匯出全部資料\n` +
          `</label>\n` +
          `</div>\n` +
          `<div id='date-range-section'>\n` +
          `<div class='row mb-3'>\n` +
          `<div class='col-6'>\n` +
          `<label class='form-label mb-2'>開始年份</label>\n` +
          `<select id='swal-year-start' class='form-select' disabled><option value=''>選擇年份</option>${yearOptions}</select>\n` +
          `</div>\n` +
          `<div class='col-6'>\n` +
          `<label class='form-label mb-2'>結束年份</label>\n` +
          `<select id='swal-year-end' class='form-select' disabled><option value=''>選擇年份</option>${yearOptions}</select>\n` +
          `</div>\n` +
          `</div>\n` +
          `</div>`,
        width: '420px',
        heightAuto: false,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '匯出',
        cancelButtonText: '取消',
        customClass: {
          popup: 'swal-wide-popup',
          htmlContainer: 'swal-html-container'
        },
        didOpen: () => {
          const selectAllCheckbox = document.getElementById('swal-select-all');
          const yearStartSelect = document.getElementById('swal-year-start');
          const yearEndSelect = document.getElementById('swal-year-end');
          
          selectAllCheckbox.addEventListener('change', function() {
            const isDisabled = this.checked;
            yearStartSelect.disabled = isDisabled;
            yearEndSelect.disabled = isDisabled;
            
            if (isDisabled) {
              yearStartSelect.value = '';
              yearEndSelect.value = '';
            }
          });
        },
        preConfirm: () => {
          const select_all = document.getElementById('swal-select-all').checked;
          
          if (select_all) {
            return { select_all: true };
          }
          
          const year_start = document.getElementById('swal-year-start').value;
          const year_end = document.getElementById('swal-year-end').value;
          
          if (!year_start && !year_end) {
            return { select_all: true };
          }
          
          if (year_start && year_end && parseInt(year_start) > parseInt(year_end)) {
            Swal.showValidationMessage('開始年份不能晚於結束年份');
            return false;
          }
          
          return {
            select_all: false,
            year_start: year_start,
            year_end: year_end
          };
        }
      });
      
      if (!formValues) return null;
      return formValues;
    },

    /**
     * 彈出請款年月區間選擇 Swal，回傳 {year_month_start, year_month_end, select_all} 或 null
     */
    async selectPaymentDateRange() {
      const years = this.getYearOptions();
      const months = this.getMonthOptions();
      const yearOptions = years.map(y => `<option value='${y}'>${y}</option>`).join('');
      const monthOptions = months.map(m => `<option value='${m.value}'>${m.text}</option>`).join('');
      
      const { value: formValues } = await Swal.fire({
        title: '選擇請款年月區間',
        html:
          `<div class='mb-3'>\n` +
          `<label class='form-check-label'>\n` +
          `<input type='checkbox' id='swal-select-all' class='form-check-input me-2' checked>\n` +
          `匯出全部資料\n` +
          `</label>\n` +
          `</div>\n` +
          `<div id='date-range-section'>\n` +
          `<div class='row mb-3'>\n` +
          `<div class='col-6'>\n` +
          `<label class='form-label mb-2'>開始年份</label>\n` +
          `<select id='swal-year-start' class='form-select' disabled><option value=''>選擇年份</option>${yearOptions}</select>\n` +
          `</div>\n` +
          `<div class='col-6'>\n` +
          `<label class='form-label mb-2'>開始月份</label>\n` +
          `<select id='swal-month-start' class='form-select' disabled><option value=''>選擇月份</option>${monthOptions}</select>\n` +
          `</div>\n` +
          `</div>\n` +
          `<div class='row mb-2'>\n` +
          `<div class='col-6'>\n` +
          `<label class='form-label mb-2'>結束年份</label>\n` +
          `<select id='swal-year-end' class='form-select' disabled><option value=''>選擇年份</option>${yearOptions}</select>\n` +
          `</div>\n` +
          `<div class='col-6'>\n` +
          `<label class='form-label mb-2'>結束月份</label>\n` +
          `<select id='swal-month-end' class='form-select' disabled><option value=''>選擇月份</option>${monthOptions}</select>\n` +
          `</div>\n` +
          `</div>\n` +
          `</div>`,
        width: '480px',
        heightAuto: false,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '匯出',
        cancelButtonText: '取消',
        customClass: {
          popup: 'swal-wide-popup',
          htmlContainer: 'swal-html-container'
        },
        didOpen: () => {
          const selectAllCheckbox = document.getElementById('swal-select-all');
          const yearStartSelect = document.getElementById('swal-year-start');
          const monthStartSelect = document.getElementById('swal-month-start');
          const yearEndSelect = document.getElementById('swal-year-end');
          const monthEndSelect = document.getElementById('swal-month-end');
          
          selectAllCheckbox.addEventListener('change', function() {
            const isDisabled = this.checked;
            yearStartSelect.disabled = isDisabled;
            monthStartSelect.disabled = isDisabled;
            yearEndSelect.disabled = isDisabled;
            monthEndSelect.disabled = isDisabled;
            
            if (isDisabled) {
              yearStartSelect.value = '';
              monthStartSelect.value = '';
              yearEndSelect.value = '';
              monthEndSelect.value = '';
            }
          });
        },
        preConfirm: () => {
          const select_all = document.getElementById('swal-select-all').checked;
          
          if (select_all) {
            return { select_all: true };
          }
          
          const year_start = document.getElementById('swal-year-start').value;
          const month_start = document.getElementById('swal-month-start').value;
          const year_end = document.getElementById('swal-year-end').value;
          const month_end = document.getElementById('swal-month-end').value;
          
          if (!year_start && !month_start && !year_end && !month_end) {
            return { select_all: true };
          }
          
          if ((year_start && !month_start) || (!year_start && month_start)) {
            Swal.showValidationMessage('請同時選擇開始年份和月份');
            return false;
          }
          
          if ((year_end && !month_end) || (!year_end && month_end)) {
            Swal.showValidationMessage('請同時選擇結束年份和月份');
            return false;
          }
          
          if (year_start && month_start && year_end && month_end) {
            const startDate = new Date(parseInt(year_start), parseInt(month_start) - 1);
            const endDate = new Date(parseInt(year_end), parseInt(month_end) - 1);
            if (startDate > endDate) {
              Swal.showValidationMessage('開始日期不能晚於結束日期');
              return false;
            }
          }
          
          return {
            select_all: false,
            year_month_start: year_start && month_start ? `${year_start}-${month_start}` : '',
            year_month_end: year_end && month_end ? `${year_end}-${month_end}` : ''
          };
        }
      });
      
      if (!formValues) return null;
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
        if (!yearRange.select_all && (yearRange.year_start || yearRange.year_end)) {
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
        const dateRange = await this.selectPaymentDateRange();
        if (dateRange === null) return;
        this.isLoading = true;
        
        // 構建匯出 URL
        let url = '/crm/export/payment-invoices/excel/';
        const params = new URLSearchParams();
        
        // 添加日期範圍參數（使用日期格式而非年月格式）
        if (!dateRange.select_all && (dateRange.year_month_start || dateRange.year_month_end)) {
          if (dateRange.year_month_start) {
            const [year, month] = dateRange.year_month_start.split('-');
            params.append('date_start', `${year}-${month}-01`);
          }
          if (dateRange.year_month_end) {
            const [year, month] = dateRange.year_month_end.split('-');
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            params.append('date_end', `${year}-${month}-${lastDay}`);
          }
        }
        
        if (params.toString()) {
          url += '?' + params.toString();
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
        const dateRange = await this.selectPaymentDateRange();
        if (dateRange === null) return;
        this.isLoading = true;
        let url = '/crm/export/invoices/csv/';
        if (!dateRange.select_all && (dateRange.year_month_start || dateRange.year_month_end)) {
          const params = [];
          if (dateRange.year_month_start) params.push(`year_month_start=${dateRange.year_month_start}`);
          if (dateRange.year_month_end) params.push(`year_month_end=${dateRange.year_month_end}`);
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
        const dateRange = await this.selectPaymentDateRange();
        if (dateRange === null) return;
        this.isLoading = true;
        const exportTasks = [
          { method: this.exportProjects, name: '專案資料', url: '/crm/export/projects/csv/', useYear: true },
          { method: this.exportOwners, name: '業主資料', url: '/crm/export/owners/csv/', useYear: false },
          { method: this.exportPayments, name: '請款資料', url: '/crm/export/payments/csv/', useYear: false },
          { method: this.exportInvoices, name: '發票資料', url: '/crm/export/invoices/csv/', useYear: false },
          { method: this.exportCategories, name: '案件類別資料', url: '/crm/export/categories/csv/', useYear: false }
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
              
              // 專案資料使用年份篩選，其他使用年月篩選
              if (task.useYear) {
                // 專案資料：將年月轉換為年份
                if (!dateRange.select_all && (dateRange.year_month_start || dateRange.year_month_end)) {
                  const params = [];
                  if (dateRange.year_month_start) {
                    const year = dateRange.year_month_start.split('-')[0];
                    params.push(`year_start=${year}`);
                  }
                  if (dateRange.year_month_end) {
                    const year = dateRange.year_month_end.split('-')[0];
                    params.push(`year_end=${year}`);
                  }
                  url += '?' + params.join('&');
                }
              } else {
                // 其他資料使用年月篩選
                if ([2,3].includes(i) && !dateRange.select_all && (dateRange.year_month_start || dateRange.year_month_end)) {
                  const params = [];
                  if (dateRange.year_month_start) params.push(`year_month_start=${dateRange.year_month_start}`);
                  if (dateRange.year_month_end) params.push(`year_month_end=${dateRange.year_month_end}`);
                  url += '?' + params.join('&');
                }
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
