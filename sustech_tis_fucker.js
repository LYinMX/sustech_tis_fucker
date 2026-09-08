// ==UserScript==
// @name         sustech_tis_fucker
// @namespace    https://github.com/LYinMX/sustech_tis_fucker
// @version      26.9.8
// @description  sustech tis 增强功能插件
// @match        https://tis.sustech.edu.cn/*
// @icon         https://www.sustech.edu.cn/static/images/favicon.ico
// @require      https://s4.zstatic.net/ajax/libs/jquery/3.7.1/jquery.min.js
// @run-at       document-start
// ==/UserScript==

(function ($) {
    'use strict';

    let cachedEnrollments = [];
    let observer = null;

    function parseEnrollments(resp) {
        let list = resp.kxrwList || resp.list || resp.data;
        if (!Array.isArray(list) && list && typeof list === 'object' && Array.isArray(list.list)) {
            list = list.list;
        }
        if (!Array.isArray(list)) list = [];
        return list.map(item => ({
            kcmc: item.kcmc || item.kc_mc || item.courseName || '未知课程',
            yxzrs: item.bksyxrs || item.yxrs || item.selectedCount || '?',
            nansyxrs: item.nansyxrs || '?',
            nvsyxrs: item.nvsyxrs || '?',
            kcdm: item.kcdm || item.kc_dm || '',
            rwmc: item.rwmc || ''
        }));
    }

    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._url = url;
        this._method = method;
        origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (this._url && (this._url.includes('Xsxk/query') || this._url.includes('Xsxk/cxqhquery'))) {
            this.addEventListener('readystatechange', function () {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        const resp = JSON.parse(this.responseText);
                        const parsed = parseEnrollments(resp);
                        if (parsed.length > 0) {
                            cachedEnrollments = parsed;
                            console.log('[真实人数] XHR 捕获到数据:', cachedEnrollments.length);
                            updatePageRealEnroll();
                            startObserver();
                        }
                    } catch (e) { console.warn('[真实人数] 解析 XHR 失败', e); }
                }
            });
        }
        return origXHRSend.apply(this, arguments);
    };

    function updatePageRealEnroll() {
        if (!cachedEnrollments || cachedEnrollments.length === 0) {
            console.warn('[真实人数] 缓存为空，无法更新');
            return;
        }

        const docs = [document];
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) docs.push(doc);
            } catch (e) {}
        });

        let totalInserted = 0;

        docs.forEach(doc => {
            cachedEnrollments.forEach(item => {
                const courseName = item.kcmc;
                const realNum = item.yxzrs;
                const male = item.nansyxrs;
                const female = item.nvsyxrs;
                if (!courseName || realNum === '?') return;

                // 查找包含课程名的表格行（tr）
                const xpath = `.//tr[descendant::*[contains(text(), '${courseName}')]]`;
                const result = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
                let row;
                while (row = result.iterateNext()) {
                    if (row.querySelector('.tis-real-enroll')) continue;

                    // 查找“已选人数”文本所在的元素
                    const numXpath = `.//*[contains(text(), '已选人数')]`;
                    const numResult = doc.evaluate(numXpath, row, null, XPathResult.ANY_TYPE, null);
                    let numNode = numResult.iterateNext();
                    if (numNode) {
                        let td = numNode.closest('td');
                        if (!td) td = numNode.parentElement;
                        if (td) {
                            const span = doc.createElement('span');
                            span.className = 'tis-real-enroll';
                            span.style.cssText = 'margin-left: 12px; color: #ff6b00; font-weight: bold; background: #fff3e0; padding: 2px 8px; border-radius: 4px; font-size: 13px; white-space: nowrap; display: inline-block;';
                            span.textContent = `人数: ${realNum} | 男: ${male} | 女: ${female}`;
                            td.appendChild(span);
                            totalInserted++;
                            console.log(`[真实人数] 插入成功：“${courseName}” → 总${realNum} 男${male} 女${female}`);
                            break;
                        }
                    }
                }
            });
        });

        console.log(`[真实人数] 共插入 ${totalInserted} 个标签`);
        if (totalInserted === 0) {
            console.warn('[真实人数] 未插入任何标签，可能页面结构变化');
        }
    }

    // ---------- MutationObserver ----------
    function startObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        const targetNode = document.querySelector('#app') || document.body;
        observer = new MutationObserver(function() {
            clearTimeout(this._timer);
            this._timer = setTimeout(() => {
                updatePageRealEnroll();
            }, 300);
        });
        observer.observe(targetNode, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
        console.log('[真实人数] MutationObserver 已启动');
    }

    // ---------- 页面加载后启动 ----------
    $(document).ready(function () {
        setTimeout(() => {
            if (cachedEnrollments.length > 0) {
                updatePageRealEnroll();
            }
            startObserver();
        }, 1500);
    });

})(jQuery.noConflict(true));