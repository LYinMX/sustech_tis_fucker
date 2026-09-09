// ==UserScript==
// @name         sustech_tis_fucker
// @namespace    https://github.com/LYinMX/sustech_tis_fucker
// @version      26.9.9
// @description  sustech tis 增强功能插件
// @match        https://tis.sustech.edu.cn/*
// @icon         https://www.sustech.edu.cn/static/images/favicon.ico
// @require      https://s4.zstatic.net/ajax/libs/jquery/3.7.1/jquery.min.js
// @run-at       document-start
// ==/UserScript==

(function ($) {
    'use strict';

    let courseDataMap = {}; // 存储所有课程数据，键为课程名，值为 { bks, yjs, male, female }
    let observer = null;

    // ---------- 解析并合并数据 ----------
    function mergeEnrollments(resp) {
        let allItems = [];

        // 1. 解析可选课程列表 (kxrwList)
        let list = resp.kxrwList || resp.list || resp.data;
        if (!Array.isArray(list) && list && typeof list === 'object' && Array.isArray(list.list)) {
            list = list.list;
        }
        if (Array.isArray(list)) {
            allItems = allItems.concat(list);
        }

        // 2. 解析已选课程列表 (yxkcList)
        if (Array.isArray(resp.yxkcList)) {
            allItems = allItems.concat(resp.yxkcList);
        }

        // 3. 存入 map，以课程名为键（覆盖已存在的）
        allItems.forEach(item => {
            const name = item.kcmc || item.kc_mc || item.courseName;
            if (!name) return;
            courseDataMap[name] = {
                bks: item.bksyxrs || item.bksyxzrs || '?',
                yjs: item.yjsyxrs || item.yjsyxzrs || '?',
                male: item.nansyxrs || '?',
                female: item.nvsyxrs || '?'
            };
        });

        console.log('[真实人数] 已合并数据，共', Object.keys(courseDataMap).length, '门课程');
    }

    // ---------- 劫持 XHR ----------
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._url = url;
        this._method = method;
        origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (this._url && this._url.includes('Xsxk/query')) {
            this.addEventListener('readystatechange', function () {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        const resp = JSON.parse(this.responseText);
                        mergeEnrollments(resp);
                        updatePageRealEnroll();
                        startObserver();
                    } catch (e) { console.warn('[真实人数] 解析失败', e); }
                }
            });
        }
        return origXHRSend.apply(this, arguments);
    };

    // ---------- 在页面上显示信息（已选和可选都适用） ----------
    function updatePageRealEnroll() {
        if (Object.keys(courseDataMap).length === 0) return;

        const docs = [document];
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) docs.push(doc);
            } catch (e) {}
        });

        let totalInserted = 0;

        docs.forEach(doc => {
            Object.keys(courseDataMap).forEach(courseName => {
                const data = courseDataMap[courseName];
                const bks = data.bks;
                const yjs = data.yjs;
                const male = data.male;
                const female = data.female;
                if (!courseName || bks === '?') return;

                // 查找包含课程名的表格行（tr）
                const xpath = `.//tr[descendant::*[contains(text(), '${courseName}')]]`;
                const result = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
                let row;
                while (row = result.iterateNext()) {
                    if (row.querySelector('.tis-real-enroll')) continue;

                    // 查找“已选人数”文本所在的元素（兼容“已选人数：”格式）
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
                            span.textContent = `本: ${bks} | 研: ${yjs} | 男: ${male} | 女: ${female}`;
                            td.appendChild(span);
                            totalInserted++;
                            break;
                        }
                    }
                }
            });
        });
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
    }

    // ---------- 页面加载后启动 ----------
    $(document).ready(function () {
        setTimeout(() => {
            if (Object.keys(courseDataMap).length > 0) {
                updatePageRealEnroll();
            }
            startObserver();
        }, 1500);
    });

})(jQuery.noConflict(true));
