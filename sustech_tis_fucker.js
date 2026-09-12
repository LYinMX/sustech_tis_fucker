// ==UserScript==
// @name         sustech_tis_fucker
// @namespace    https://github.com/LYinMX/sustech_tis_fucker
// @version      26.9.12
// @description  sustech tis 增强功能插件
// @match        https://tis.sustech.edu.cn/*
// @icon         https://www.sustech.edu.cn/static/images/favicon.ico
// @require      https://s4.zstatic.net/ajax/libs/jquery/3.7.1/jquery.min.js
// @run-at       document-start
// ==/UserScript==

(function ($) {
    'use strict';

    const courseDataMap = {};
    let observer = null;

    function mergeEnrollments(resp) {
        let list = resp.kxrwList || resp.list || resp.data;
        if (!Array.isArray(list) && list && Array.isArray(list.list)) list = list.list;
        const allItems = [];
        if (Array.isArray(list)) allItems.push(...list);
        if (Array.isArray(resp.yxkcList)) allItems.push(...resp.yxkcList);

        for (const item of allItems) {
            const rwmc = item.rwmc || '';
            if (!rwmc) continue;
            courseDataMap[rwmc] = {
                bks: item.bksyxrs || item.bksyxzrs || '?',
                yjs: item.yjsyxrs || item.yjsyxzrs || '?',
                male: item.nansyxrs || '?',
                female: item.nvsyxrs || '?'
            };
        }
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (this._url && this._url.includes('Xsxk/query')) {
            this.addEventListener('readystatechange', function () {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        mergeEnrollments(JSON.parse(this.responseText));
                        updatePage();
                        startObserver();
                    } catch (e) {}
                }
            });
        }
        return origSend.apply(this, arguments);
    };

    function findRow(doc, rwmc) {
        for (const td of doc.querySelectorAll('td')) {
            if (td.textContent.trim() === rwmc) return td.closest('tr');
        }
        return null;
    }

    function updatePage() {
        const docs = [document];
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                if (iframe.contentDocument) docs.push(iframe.contentDocument);
            } catch (e) {}
        });

        for (const doc of docs) {
            for (const rwmc in courseDataMap) {
                const data = courseDataMap[rwmc];
                if (data.bks === '?') continue;
                const row = findRow(doc, rwmc);
                if (!row || row.querySelector('.tis-real-enroll')) continue;

                const numNode = doc.evaluate(".//*[contains(text(), '已选人数')]", row, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (!numNode) continue;
                let td = numNode.closest('td') || numNode.parentElement;
                if (!td) continue;

                const span = doc.createElement('span');
                span.className = 'tis-real-enroll';
                span.style.cssText = 'margin-left:12px;color:#ff6b00;font-weight:bold;background:#fff3e0;padding:2px 8px;border-radius:4px;font-size:13px;white-space:nowrap;display:inline-block;';
                span.textContent = `本: ${data.bks} | 研: ${data.yjs} | 男: ${data.male} | 女: ${data.female}`;
                td.appendChild(span);
            }
        }
    }

    function startObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => {
            clearTimeout(observer._timer);
            observer._timer = setTimeout(updatePage, 300);
        });
        observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
    }

    $(function () {
        setTimeout(() => {
            if (Object.keys(courseDataMap).length) updatePage();
            startObserver();
        }, 1500);
    });

})(jQuery.noConflict(true));
