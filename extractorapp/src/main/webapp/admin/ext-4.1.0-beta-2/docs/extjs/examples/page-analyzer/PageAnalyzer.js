Ext.Loader.setConfig({
    enabled: true
});

Ext.Loader.setPath({
    'Ext.ux': '../ux/',
    'PageAnalyzer': './'
});

Ext.require([
    'Ext.data.*',
    'Ext.tree.*',
    'Ext.container.Viewport',
    'Ext.layout.container.Border',
    'Ext.History',
    'Ext.tab.Panel',
    'Ext.grid.column.Action',
    'Ext.form.field.TextArea',
    'Ext.form.field.Number',
    'Ext.toolbar.TextItem',
    'Ext.layout.container.Table',
    'PageAnalyzer.models.LayoutTreeNode',
    'PageAnalyzer.Console',
    'PageAnalyzer.Summary',
    'Ext.ux.IFrame',
    'Ext.state.Manager',
    'Ext.state.CookieProvider'
]);

Ext.define('PageAnalyzer.MainForm', {
    statsGatherCount: 0,

    layoutTpl: [
        '<tpl if="isBoxParent">',
            '<img class="x-tree-icon" src="resources/images/boxParent.gif">',
        '</tpl>',
        '{name:this.encode}',
        {
            encode: function (value) {
                return Ext.htmlEncode(value);
            }
        }
    ],

    runTpl: [
        'Run #{num} ({time:this.date})',
        {
            date: function (value) {
                return Ext.Date.format(value, "Y-m-d H:i:s");
            }
        }
    ],

    triggerTpl: [
        '<div class="pgan-{[values.missing ? "missing" : "available"]}-value">',
            '{name} (={[String(values.value) || "?"]}) - dirty: {dirty} - setBy: {setBy:this.encode}',
        '</div>',
        {
            encode: function (value) {
                return Ext.htmlEncode(value);
            }
        }
    ],

    constructor: function (config) {
        Ext.state.Manager.setProvider(Ext.create('Ext.state.CookieProvider'));

        var me = this;

        Ext.apply(me, config);

        me.runNumber = 0;

        me.viewport = Ext.widget(me.createViewport());
        me.target = me.targetFrame.getWin();

        me.rawDataTextArea = me.viewport.down('#rawDataTextArea');
        me.reloadBtn = me.viewport.down('#reloadBtn');
        me.stateText = me.viewport.down('#stateText');

        if (me.target) {
            setInterval(function() {
                me.updateConnectedState();
            }, 100);
        } else {
            me.reloadBtn.setDisabled(true);
        }

    },

    createDetails: function() {
        return {
            title: 'Details',
            xtype: 'tabpanel',
            tabPosition: 'bottom',
            height: '20%',
            split: true,
            collapsible: true,
            collapsed: true,
            region: 'east',
            items: [{
                title: 'Raw Data',
                xtype: 'textarea',
                selectOnFocus: true,
                itemId: 'rawDataTextArea',
                style: 'margin:0'
            }, {
                title: 'Log',
                html: 'Under construction'
            }]
        };
    },

    roundTimestamp: function(num) {
        return Math.round(num * 100) / 100;
    },

    createLayoutTree: function() {
        var me = this,
            store = new Ext.data.TreeStore({
                proxy: 'memory',
                model: 'PageAnalyzer.models.LayoutTreeNode'
            }),
            tree = {
                xtype: 'treepanel',
                store: store,
                rootVisible: false,
                useArrows: true,
                title: 'Layouts',
                region: 'center',
                viewConfig: {
                    getRowClass: function (record) {
                        return 'pgan-' + record.data.type;
                    }
                },
                columns: [
                    {
                        xtype: 'treecolumn',
                        text: 'Layout',
                        flex: 1,
                        hideable: false,
                        draggable: false,
                        dataIndex: 'text'
                    },
                    {
                        text: 'Triggers',
                        width: 200,
                        dataIndex: 'triggers'
                    },
                    {
                        text: 'Blocks',
                        width: 125,
                        hidden: true,
                        dataIndex: 'blocks',
                        id: 'blocksCol'
                    },
                    {
                        text: 'Width',
                        width: 90,
                        dataIndex: 'widthModel'
                    },
                    {
                        text: 'Height',
                        width: 90,
                        dataIndex: 'heightModel'
                    },
                    {
                        text: 'Box Parent',
                        width: 100,
                        hidden: true,
                        dataIndex: 'boxParent',
                        id: 'boxParentCol'
                    },
                    {
                        text: 'Time',
                        width: 70,
                        dataIndex: 'duration',
                        id: 'durationCol',
                        renderer: me.roundTimestamp
                    },
                    {
                        text: 'Calls',
                        width: 50,
                        dataIndex: 'count',
                        id: 'countCol'
                    },
                    {
                        text: 'Avg Time',
                        width: 70,
                        id: 'avgCol',
                        renderer: function(value, metadata, rec) {
                            return me.roundTimestamp(rec.data.duration / rec.data.count);
                        }
                    },
                    {
                        text: 'Tot Time',
                        width: 70,
                        dataIndex: 'totalTime',
                        id: 'totalTimeCol',
                        renderer: me.roundTimestamp
                    },
                    {
                        menuDisabled: true,
                        sortable: false,
                        xtype: 'actioncolumn',
                        hideable: false,
                        width: 20,
                        items: [{
                            icon: 'resources/images/delete.gif',
                            iconCls: 'pgan-delete-row',
                            tooltip: 'Delete this run',
                            handler: this.onDeleteLayoutRun,
                            scope: this
                        }]
                    }
                ]
            };

        this.layoutTree = Ext.widget(tree);

        this.layoutTree.getSelectionModel().on({
            selectionchange: this.onLayoutSelectionChange,
            scope: this
        });

        return this.layoutTree;
    },

    createPerfPanel: function() {

        var me = this;
        me.build = 1;

        me.perfPanel = Ext.widget({
            xtype: 'panel',
            title: 'Performance',
            layout: 'fit',
            border: false,
            tbar: [
                {
                    xtype: 'numberfield',
                    fieldLabel: 'Build',
                    style: 'margin-right: 10px;',
                    labelWidth: 30,
                    width: 100,
                    value: me.build,
                    listeners: {
                        change: function (field) {
                            me.build = field.getValue();
                        }
                    }
                },
                {
                    text: 'Update',
                    handler: me.onGatherStats,
                    scope: me
                },
                {
                    text: 'Clear',
                    handler: me.onClearStats,
                    scope: me
                }
            ],
            items: [
                new PageAnalyzer.Console({
                    itemId: 'perfcon'
                })
            ]
        });

        return me.perfPanel;
    },

    createLayoutPanel: function() {
        var me = this;
        me.layoutPanel = Ext.widget({
            xtype: 'panel',
            title: 'Layout',
            layout: 'border',
            tbar: [
                {
                    text: 'Load Run',
                    iconCls: 'pgan-load-run',
                    handler: me.onLoadRun,
                    scope: me
                },
                {
                    text: 'Show All Triggers',
                    enableToggle: true,
                    handler: me.onShowAllTriggers,
                    scope: me
                },
                {
                    text: 'Clear',
                    handler: me.onClearLayouts,
                    scope: me
                }
            ],
            items: [
                me.createLayoutTree(),
                me.createDetails(),
                this.typeSummary = new PageAnalyzer.Summary({
                    title: 'Summaries',
                    region: 'south',
                    height: '50%',
                    collapsible: true,
                    split: true
                })
            ]
        });
        return me.layoutPanel;
    },

    createTestPagePanel: function() {
        return this.targetFrame = Ext.create("Ext.ux.IFrame", {
            title: 'Page Under Test',
            hideMode: 'offsets'
        });
    },

    createViewport: function() {
        var me = this,
            ret =  {
            xtype: 'viewport',
            layout: 'fit',
            items: [
                {
                    xtype: 'panel',
                    layout: 'fit',
                    tbar: {
                        layout: 'table',
                        items: [
                            {
                                xtype: 'tbtext',
                                text: 'Test URL:',
                                itemId: 'titleLbl',
                                tdAttrs: {
                                    width: '100px'
                                }
                            },
                            me.targetUrlField = Ext.widget({
                                xtype: 'textfield',
                                itemId: 'targetUrl',
                                stateId: 'targetUrlField',
                                selectOnFocus: true,
                                tdAttrs: {
                                    width: '100%'
                                },
                                style: {
                                    width: '100%'
                                },
                                //value: 'abc1234',
                                enableKeyEvents: true,
                                listeners: {
                                    keypress: function(f, e) {
                                        if (e.getKey() === 13) {
                                            me.onLoadPage();
                                        }
                                    }
                                }
                            }),
                            {
                                text: 'Load',
                                itemId: 'reloadBtn',
                                iconCls: 'pgan-refresh',
                                handler: me.onLoadPage,
                                scope: me,
                                tdAttrs: {
                                    width: '100px'
                                }
                            },
                            {
                                xtype: 'tbtext',
                                itemId: 'stateText',
                                tdAttrs: {
                                    width: '100px'
                                }
                            }
                        ]
                    },
                    items: [
                        Ext.create('Ext.tab.Panel', {
                            items:[
                                me.createTestPagePanel(),
                                me.createLayoutPanel(),
                                me.createPerfPanel()
                            ]
                        })
                    ]
                }
            ]
        };

        return ret;
    },

    addLayoutChildren: function (parent, children) {
        var n = children.length,
            triggersTpl = Ext.XTemplate.getTpl(this, 'triggerTpl'),
            textTpl = Ext.XTemplate.getTpl(this, 'layoutTpl'),
            child, data, i, j, k, node, triggers;

        for (i = 0; i < n; ++i) {
            child = children[i];
            triggers = [];
            for (j = 0, k = child.triggers.length; j < k; ++j) {
                triggers.push(triggersTpl.apply(child.triggers[j]));
            }

            data = {
                text: textTpl.apply(child),
                iconCls: 'pgan-layout' +
                    (child.allDone ? '' : (child.done ? '-partial' : '-not')) + '-done',
                leaf: !child.children.length,
                triggers: triggers.join(''),
                blocks: child.blocks.join('<br>'),
                boxParent: child.boxParent,
                isBoxParent: child.isBoxParent,
                heightModel: child.heightModel,
                widthModel: child.widthModel,
                type: 'layout',
                duration: child.duration,
                totalTime: child.totalTime,
                count: child.count
            };

            if (data.boxParent) {
                this.showBoxParentCol = true;
            }
            if (data.blocks) {
                this.showBlocksCol = true;
            }

            node = new PageAnalyzer.models.LayoutTreeNode(data);
            parent.appendChild(node);
            this.addLayoutChildren(node, child.children);
        }
    },

    addLayoutRuns: function (run) {
        if (typeof run == 'string') {
            run = Ext.decode(run);
        }
        if (Ext.isArray(run)) {
            Ext.each(run, this.addLayoutRuns, this);
            return;
        }
        if (typeof run.time == 'string') {
            run.time = Ext.Date.parse(run.time, "Y-m-d\\TH:i:s");
        }
        if (typeof run.duration == 'string') {
            run.duration = parseInt(run.duration, 10);
        }

        //run.success = 0;
        run.num = ++this.runNumber;

        var node = new PageAnalyzer.models.LayoutTreeNode({
            text: Ext.XTemplate.getTpl(this, 'runTpl').apply(run),
            iconCls: 'pgan-' + (run.success ? 'good' : 'failed') + '-layout-run',
            type: 'layoutrun',
            duration: run.duration,
            totalTime: run.totalTime,
            count: 1
        });

        this.showBoxParentCol = this.showBlocksCol = false;

        node.rawData = run;

        node.appendChild(new PageAnalyzer.models.LayoutTreeNode({
            text: 'Flush',
            leaf: true,
            duration: run.flushTime,
            totalTime: run.flushTime,
            count: run.flushCount
        }));

        node.appendChild(new PageAnalyzer.models.LayoutTreeNode({
            text: 'Invalidate',
            leaf: true,
            duration: run.flushInvalidateTime,
            totalTime: run.flushInvalidateTime,
            count: run.flushInvalidateCount
        }));

        Ext.Object.each(run.flushLayoutStats, function(name, val) {
            node.appendChild(new PageAnalyzer.models.LayoutTreeNode({
                text: (name == 'notifyOwner')
                    ? 'AfterLayout'
                    : Ext.String.capitalize(name),
                leaf: true,
                duration: val.time,
                totalTime: val.time,
                count: val.count
            }));
        });

        this.addLayoutChildren(node, run.layouts);

        this.layoutTree.getRootNode().appendChild(node);

        Ext.suspendLayouts();
        if (this.showBoxParentCol) {
            this.layoutTree.down('#boxParentCol').show();
        }
        if (this.showBlocksCol) {
            this.layoutTree.down('#blocksCol').show();
        }
        Ext.resumeLayouts(true);
    },

    onDeleteLayoutRun: function (view, recordIndex, cellIndex, item, e, record) {
        record.parentNode.removeChild(record);
    },

    onLayoutSelectionChange: function(selModel, records) {
        var run, text;

        if (records.length) {
            run = records[0];
            while (run && run.data.type != 'layoutrun') {
                run = run.parentNode;
            }

            text = Ext.JSON.encodeValue(run.rawData, '\n');
            this.rawDataTextArea.setValue(text);
            this.typeSummary.loadTypeSummary(run.rawData.statsByType);
        }
    },

    onLoadRun: function() {
        var me = this;

        var window = new Ext.Window({
            title: 'Load Run',
            width: 400,
            height: 320,
            layout: 'fit',
            modal: true,
            items: [{
                xtype: 'textarea'
            }],
            buttons: [{
                text: 'OK',
                handler: function() {
                    var text = window.down('textarea').getValue();
                    window.destroy();

                    me.addLayoutRuns(text);
                }
            }, {
                text: 'cancel',
                handler: function() {
                    window.destroy();
                }
            }]
        });

        window.show();
    },

    onClearLayouts: function() {
        this.layoutTree.getRootNode().removeAll();
    },

    onShowAllTriggers: function (button) {
        var comp = this.layoutTree;

        if (button.pressed) {
            comp.addCls('pgan-show-all-triggers');
        } else {
            comp.removeCls('pgan-show-all-triggers');
        }

        comp.updateLayout();
    },

    updateLayoutRuns: function() {
        var me = this,
            target = me.target,
            runs = target._layoutRuns;

        if (runs && runs.length) {
            target._layoutRuns = [];
            me.addLayoutRuns(runs);
        }
    },

    onGatherStats: function() {
        var me = this,
            target = me.target,
            perf = target.Ext.Perf,
            con = me.viewport.down('#perfcon');

        // Only gather page startup stats at each reload, not on each gather
        if (!me.statsGatherCount) {
            var a1 = perf.get("Initialize").enter().leave(target.Ext._afterReadytime - target.Ext._beforeReadyTime);
            if (target.Ext._endTime) {
                var a2 = perf.get("Load").enter().leave(target.Ext._endTime - target.Ext._startTime),
                    a3 = perf.get("WaitForReady").enter().leave(target.Ext._readyTime - target.Ext._endTime);

            } else {
                var a4 = perf.get("BeforeReady").enter().leave(target.Ext._readyTime - target.Ext._startTime);
            }
        }

        me.statsGatherCount++;
        var data = perf.getData(),
            accCfg = perf.currentConfig;

        con.addSample({
            env: 'x',
            build: me.build,
            test: target.location.pathname,
            data: data
        });

        if (accCfg) {
            con.setAccumulators(accCfg);
        }
    },

    onClearStats: function() {
        var con = this.viewport.down('#perfcon');

        con.clearSamples();
    },

    getHrefMinusHash: function() {
        var href = location.href.replace(Ext.History.getHash(), '');
        return href;
    },

//-------------------------------------------------------------------------
    // Target page mgmt

    states: {
        // the target page has not loaded Ext
        disconnected: {
            text: 'Disconnected',
            style: {
                fontWeight: 'bold',
                color: 'red'
            }
        },

        // the target page is loaded and has Ext.isReady
        loaded: {
            text: 'Loaded',
            style: {
                fontWeight: 'bold',
                color: 'orange'
            }
        },

        // the target page is loading the layout hooks
        hooking: {
            text: 'Loading hooks',
            style: {
                fontWeight: 'bold',
                color: 'yellow'
            }
        },

        ready: { 
            text: 'Ready',
            style: {
                fontWeight: 'bold',
                color: 'green'
            }
        }
    },

    getState: function() {
        var states = this.states,
            target = this.target;

        if (target && target.Ext && target.Ext.isReady) {
            if (target._layoutRuns) {
                return states.ready;
            }
            if (target._hooking) {
                return states.hooking;
            }
            return states.loaded;
        }

        return states.disconnected;
    },

    injectScript: function (script) {
        var me = this,
            url = me.getHrefMinusHash().replace(/\/[^/]+$/, '/' + script),
            target = me.targetFrame.getDoc(),
            head = target.head || target.getElementsByTagName('head')[0];

        if (target == document) debugger

        var script = target.createElement('script');

        script.src = url;
        script.type = 'text/javascript';
        head.appendChild(script);
    },

    injectHooks: function() {
        var me=this,
            target = me.target,
            con = me.viewport.down('#perfcon'),
            accCfg = con.getAccumulators();

        target._hooking = 3;
        target._accumulatorCfg = accCfg;
        me.injectScript('hooks.js');
    },

    onLoadPage: function() {
        var me = this,
            target = me.targetFrame,
            doc = target.getDoc(),
            targetUrl = me.targetUrlField.getValue();

        if (targetUrl && targetUrl != '' && doc) {
            // add a query parameter the target page url so it will pause at onReady so that
            // we can inject our code and resume it to capture the initial layout run
            // by setting a global override flag (in updateConnectedState):

            me.target._layoutRuns = null;

            var hasPound = targetUrl.indexOf('#'),
                hasQuest = targetUrl.indexOf('?') ,
                qParm = (hasQuest > 0 ? '&' : '?') + 'ext-pauseReadyFire';

            if(hasPound > 0) {
                targetUrl =
                    targetUrl.substring(0, hasPound) +
                    qParm +
                    targetUrl.substring(hasPound + 1);
            } else {
                targetUrl += qParm;
            }

            me.targetFrame.load(targetUrl);
            me.currUrl = targetUrl;
            me.reloading = true;
            me.updateConnectedState();
            me.statsGatherCount = 0;

        } else {
            me.targetFrame.load('about:blank');
        }
    },

    updateConnectedState: function() {
        var me = this,
            states = me.states,
            state = me.getState();

        if (me.lastState != state) {
            me.lastState = state;
            me.stateText.el.setStyle(state.style);
            me.stateText.setText(state.text);
        }

        if (state == states.loaded) {
            me.injectHooks();
        } else if (state == states.ready) {
            if (me.reloading) {
                me.reloading = false;
                me.target.Ext._continueFireReady = true;
                me.target.Ext.EventManager.readyEvent.fire();
            }

            me.updateLayoutRuns();
        }
    }
});

(function() {
    function run () {
        Ext.QuickTips.init();
        new PageAnalyzer.MainForm({
            targetHref: window.opener
                ? window.opener.location.href
                : null
        });
    }

    Ext.onReady(run);
})();
