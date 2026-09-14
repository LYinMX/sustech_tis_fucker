// ==UserScript==
// @name         sustech_tis_fucker
// @namespace    https://github.com/LYinMX/sustech_tis_fucker
// @version      26.9.14
// @description  sustech tis 增强功能插件
// @match        https://tis.sustech.edu.cn/*
// @icon         https://www.sustech.edu.cn/static/images/favicon.ico
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const people = {};
    const grades = {};
    let observer = null;

    function mergePeople(resp) {
        let list = resp.rwList || resp.kxrwList || resp.list || resp.data || resp.rows;
        if (!Array.isArray(list) && list?.list) list = list.list;
        const items = [...(Array.isArray(list) ? list : []), ...(resp.yxkcList || [])];
        for (const it of items) {
            if (!it.rwmc) continue;
            people[it.rwmc] = {
                bks: it.bksyxrs || it.bksyxzrs || 0,
                yjs: it.yjsyxrs || it.yjsyxzrs || 0,
                male: it.nansyxrs || 0,
                female: it.nvsyxrs || 0
            };
        }
    }

    function mergeGrades(resp) {
        const list = resp?.content?.list;
        if (!Array.isArray(list)) return;
        for (const it of list) {
            if (!it.kcmc) continue;
            grades[it.kcmc] = { pm: it.pm ?? '?', zrs: it.zrs ?? '?' };
        }
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this._url = u; origOpen.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
        const url = this._url || '';
        let task = null;
        if (url.includes('Xsxk/query'))          task = handleXsxk;
        else if (url.includes('Xsxktz/query'))   task = handleXsxktz;
        else if (url.includes('/cjgl/grcjcx/grcjcx')) task = handleCj;
        if (task) {
            this.addEventListener('readystatechange', function () {
                if (this.readyState !== 4 || this.status !== 200) return;
                try { task(JSON.parse(this.responseText)); } catch (e) {}
            });
        }
        return origSend.apply(this, arguments);
    };

    function tag(text, cls) {
        const span = document.createElement('span');
        span.className = cls;
        span.style.cssText = 'margin-left:8px;color:#ff6b00;font-weight:bold;background:#fff3e0;padding:2px 6px;border-radius:4px;font-size:12px;white-space:nowrap;display:inline-block;';
        span.textContent = text;
        return span;
    }

    function findRow(name) {
        for (const td of document.querySelectorAll('td')) {
            if (td.textContent.trim() === name) return td.closest('tr');
        }
        return null;
    }

    function cellOf(td) {
        return td?.querySelector('.ivu-table-cell') || td;
    }

    function watch() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => {
            clearTimeout(observer._t);
            observer._t = setTimeout(runAll, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function handleXsxk(resp) {
        mergePeople(resp);
        renderXsxk();
        watch();
    }

    function handleXsxktz(resp) {
        mergePeople(resp);
        renderXsxktz();
        watch();
    }

    function handleCj(resp) {
        mergeGrades(resp);
        renderCj();
        watch();
    }

    function renderXsxk() {
        for (const rwmc in people) {
            const row = findRow(rwmc);
            if (!row || row.querySelector('.tis-real-enroll')) continue;
            const node = document.evaluate(".//*[contains(text(), '已选人数')]", row, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) continue;
            const cell = cellOf(node.closest('td'));
            if (!cell) continue;
            const d = people[rwmc];
            cell.appendChild(tag(`本: ${d.bks} | 研: ${d.yjs} | 男: ${d.male} | 女: ${d.female}`, 'tis-real-enroll'));
        }
    }

    function renderXsxktz() {
        for (const rwmc in people) {
            const row = findRow(rwmc);
            if (!row || row.querySelector('.tis-real-enroll')) continue;
            const cells = row.querySelectorAll('td');
            const cell = cellOf(cells[cells.length - 1]);
            if (!cell) continue;
            const d = people[rwmc];
            cell.appendChild(tag(`本: ${d.bks} | 研: ${d.yjs} | 男: ${d.male} | 女: ${d.female}`, 'tis-real-enroll'));
        }
    }

    function renderCj() {
        let idx = -1;
        document.querySelectorAll('th').forEach((th, i) => {
            if (idx === -1 && th.textContent.includes('总评成绩')) idx = i;
        });
        for (const kcmc in grades) {
            const row = findRow(kcmc);
            if (!row || row.querySelector('.tis-cj-rank')) continue;
            const cells = row.querySelectorAll('td');
            const td = (idx >= 0 && cells[idx]) ? cells[idx] : null;
            if (!td) continue;
            const cell = cellOf(td);
            if (!cell) continue;
            const d = grades[kcmc];
            cell.appendChild(tag(`${d.pm} / ${d.zrs}`, 'tis-cj-rank'));
        }
    }

    function runAll() {
        renderXsxk();
        renderXsxktz();
        renderCj();
    }

    window.addEventListener('load', () => {
        runAll();
        watch();
    });

})();