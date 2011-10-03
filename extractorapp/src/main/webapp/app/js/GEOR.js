/*
 * Copyright (C) Camptocamp
 *
 * This file is part of geOrchestra
 *
 * geOrchestra is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with geOrchestra.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * @include GEOR_proj4jsdefs.js
 * @include GEOR_data.js
 * @include GEOR_map.js
 * @include GEOR_config.js
 * @include GEOR_ajaxglobal.js
 * @include GEOR_waiter.js
 * @include GEOR_toolbar.js
 * @include GEOR_layerstree.js
 * @include GEOR_layeroptions.js
 * @include GEOR_referentials.js
 * @include GeoExt/widgets/MapPanel.js
 */

Ext.namespace("GEOR");

(function() {

    var email = null;

    /**
     * Handler for extract all checked layers button.
     */
    var extractHandler = function(b) {
        email = email || GEOR.data.email;
        var emailRegexp = /^([\w\-\'\-]+)(\.[\w-\'\-]+)*@([\w\-]+\.){1,5}([A-Za-z]){2,4}$/;

        if (emailRegexp.test(email)) {
            GEOR.layerstree.extract(email, b);
        } else {
            // prompt for valid email and process the extraction using a callback
            Ext.Msg.prompt('Email', 'Saisissez une adresse email valide : ', function(btn, text){
                if (btn == 'ok'){
                    if (emailRegexp.test(text)) {
                        email = text;
                        GEOR.layerstree.extract(email, b);
                    }
                    else {
                        GEOR.util.errorDialog({
                            msg: "L'email n'est pas valide. Abandon de l'extraction."
                        });
                    }
                }
            });
        }
    };

    Ext.onReady(function() {

        /*
         * Setting of OpenLayers global vars.
         */

        OpenLayers.Lang.setCode('fr');
        OpenLayers.Number.thousandsSeparator = " ";
        OpenLayers.ImgPath = 'resources/app/img/openlayers/';
        OpenLayers.DOTS_PER_INCH = GEOR.config.MAP_DOTS_PER_INCH;
        OpenLayers.IMAGE_RELOAD_ATTEMPTS = 3;

        /*
         * Setting of proj4js global vars.
         */

        Proj4js.libPath = 'resources/lib/proj4js/lib/';

        /*
         * Setting of Ext global vars.
         */

        Ext.BLANK_IMAGE_URL = "resources/lib/externals/ext/resources/images/default/s.gif";
        Ext.apply(Ext.MessageBox.buttonText, {
            yes: "Oui",
            no: "Non",
            ok: "OK",
            cancel: "Annuler"
        });
        
        /*
         * Initialize the application.
         */

        GEOR.waiter.init();
        var map = GEOR.map.create();
        var vectorLayer = GEOR.map.createVectorLayer();

        /*
         * Create the page's layout.
         */
        
        // the header
        var vpItems = GEOR.header ? 
            [{
                xtype: "box",
                id: "geor_header",
                region: "north", 
                height: 90,
                el: "go_head"
            }] : [];

        vpItems.push({
            region: "center",
            layout: "border",
            id: 'layerconfig',
            title: "Paramètres d'extraction appliqués par défaut à toutes les couches du panier",
            iconCls: 'config-layers',
            defaults: {
                defaults: {
                    border: false
                },
                border: false
            },
            items: [
                GEOR.layeroptions.create(map, {
                    region: "north",
                    vectorLayer: vectorLayer,
                    height: 105
                }),
                {
                    region: "center",
                    xtype: "gx_mappanel",
                    id: "mappanel",
                    map: map,
                    tbar: GEOR.toolbar.create(map)
                }
            ]
        }, {
            region: "west",
            border: false,
            width: 300,
            minWidth: 300,
            maxWidth: 500,
            split: true,
            collapseMode: 'mini',
            layout: "border",
            items: [{
                region: "north",
                html: ["Configurez les paramètres généraux de votre extraction en utilisant le panneau ci-contre à droite (affiché en sélectionnant 'Paramètres par défaut').", "Vous pouvez ensuite lancer l'extraction en cliquant sur le bouton 'Extraire les couches cochées'.", "Si vous souhaitez préciser des paramètres d'extraction spécifiques pour une couche donnée, sélectionnez la dans l'arbre ci-dessous."].join('<br/><br/>'),
                bodyCssClass: 'paneltext',
                height: 170,
                autoScroll: true,
                title: 'Extracteur',
                iconCls: 'home',
                collapsible: true,
                split: true
            }, {
                xtype: 'tabpanel',
                activeTab: 0,
                region: 'center',
                defaults: {
                    defaults: {
                        border: false
                    },
                    border: false
                },                    
                items: [{
                    layout: "fit",
                    title: "Configuration",
                    items: GEOR.layerstree.create(),
                    bbar: [ '->',
                        {
                            id: "geor-btn-extract-id",
                            text: "Extraire les couches cochées",
                            iconCls: "geor-btn-extract",
                            handler: function() {
                                if (GEOR.layerstree.getSelectedLayersCount() > 0) {
                                    extractHandler(this);
                                } else {
                                    var dialog = Ext.Msg.confirm('Aucune couche dans le panier', 
                                    "Vous n'avez pas sélectionné de couche pour l'extraction. Tout extraire ?", function(btn, text){
                                        if (btn == 'yes'){
                                            GEOR.layerstree.selectAllLayers();
                                            extractHandler(this);
                                        } else {
                                            dialog.hide();
                                        }
                                    }, this);
                                }
                            }
                        }
                    ]
                }, {
                    layout:"border",
                    title: "Recentrage",
                    defaults: {
                        border: false
                    },
                    items: [
                        Ext.apply({
                            height: 150,
                            region: 'north'
                        }, GEOR.referentials.create(map)),
                        {
                            xtype: 'container',
                            autoEl: 'div',
                            cls: 'x-panel-body x-panel-body-noborder',
                            html: ' ',
                            region: 'center'
                        }
                    ]
                }]
            }]
        });    
        
        // the viewport
        new Ext.Viewport({
            layout: "border",
            items: vpItems
        });
        
        var saveLayerOptions = function() {
            GEOR.layerstree.saveExportOptions(GEOR.layeroptions.getOptions());
        };
        
        GEOR.layerstree.events.on({
            "beforelayerchange": saveLayerOptions,
            "beforeextract": saveLayerOptions,
            "layerchange": function(options, global) {
                GEOR.layeroptions.setOptions(options, global);
                var layerOptionsPanel = Ext.getCmp('layerconfig');
                if (global) {
                    layerOptionsPanel.setTitle("Paramètres d'extraction appliqués par défaut à toutes les couches du panier", 'config-layers');
                } else {
                    var isRaster = (options.owsType == 'WCS');
                    layerOptionsPanel.setTitle("Paramètres d'extraction spécifiques à la couche "+options.layerName+
                        (isRaster ? 
                        ' (raster)' : ' (vecteur)'), 
                        isRaster ? 
                        'raster-layer' : 'vector-layer'
                    );
                }
            }
        });
        GEOR.referentials.events.on({
            "recenter": GEOR.layeroptions.setBbox
        });

        // we monitor ajax requests only when the layer tree has finished loading
        // so that the user is not bothered with useless popups
        GEOR.layerstree.init(map, vectorLayer, GEOR.ajaxglobal.init);
    });
})();
