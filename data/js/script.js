class LabelLoader {
	constructor(requestsQueue) {
		this.autoRequest = false;
		this.cache = {};
		this.queue = {};
		this.queueRequesting = [];
		this.queueToRequest = [];
		this.requestQueue = requestsQueue;
	}
	static getLabel(wikidataLabels) {
		if(typeof wikidataLabels[Settings.getLanguage()] == "object") {
			return wikidataLabels[Settings.getLanguage()].value;
		} else if(typeof wikidataLabels["en"] == "object") {
			return wikidataLabels["en"].value;
		} else if(typeof Object.keys(wikidataLabels).length > 0) {
			return wikidataLabels[Object.keys(wikidataLabels)[0]];
		} else {
			return null;
		}
	}
	enqueue(wikidataId, callbackSuccess, callbackError) {
		if(typeof this.cache[wikidataId] == "object") {
			callbackSuccess(this.cache[wikidataId]);
		} else {
			if(typeof this.queue[wikidataId] == "undefined") this.queue[wikidataId] = [];
			
			this.queue[wikidataId].push(new LabelLoaderQueueItem(callbackSuccess, callbackError));

			if(this.queueRequesting.includes(wikidataId) && this.autoRequest) {
				this._enqueueRequest(wikidataId);
			} else {
				if(!this.queueToRequest.includes(wikidataId)) this.queueToRequest.push(wikidataId);
			}
		}
	}
	enqueueAndReplace(wikidataId, elem, fallback) {
		this.enqueue(wikidataId, function(wikidataLabels) {
			if(!Array.isArray(elem)) elem = [elem];

			var label = LabelLoader.getLabel(wikidataLabels);
			if(label != null || typeof fallback == "string") {
				$.each(elem, function(i, val) {
					val.textContent = label || fallback;
				});
			}
		});
	}
	startWork() {
		var _this = this;

		this._enqueueRequest(this.queueToRequest);
		$.each(this.queueToRequest, function(i, val) {
			if(!_this.queueRequesting.includes(val)) _this.queueRequesting.push(val);
		});
		
		this.queueToRequest = [];
	}
	_enqueueRequest(wikidataIds) {
		if(typeof wikidataIds == "string") wikidataIds = [wikidataIds];

		var ids = wikidataIds.slice(0);
		var _this = this;
		while(ids.length > 0) {
			var idsSegment = ids.slice(0,50);

			this.requestQueue.enqueueRequest(function(requestQueue) {
				$.ajax({
					data: {
						"action": "wbgetentities",
						"props": "labels",
						"format": "json",
						"languages": `${Settings.getLanguage()}|en`,
						"origin": "*",
						"ids": idsSegment.join("|")
					},
					url: "https://www.wikidata.org/w/api.php"
				}).always(function(e) {
					requestQueue._finishRequest();
				}).done(function(e) {
					console.log(e);
					$.each(idsSegment, function(i, wikidataId) {
						_this.queueRequesting.pop(wikidataId);
						$.each(_this.queue[wikidataId], function(j, val) {
							if(typeof e.entities == "object" && typeof e.entities[wikidataId] == "object") {
								val.callbackSuccess(e.entities[wikidataId].labels);
							} else {
								if(typeof val.callbackError == "function") val.callbackError();
							}
						});
						delete _this.queue[wikidataId];
					});
				}).fail(function(e) {
					$.each(idsSegment, function(i, wikidataId) {
						_this.queueRequesting.pop(wikidataId);
						$.each(_this.queue[wikidataId], function(i, val) {
							if(typeof val.callbackError == "function") val.callbackError();
						});
						delete _this.queue[wikidataId];
					});
				});
			});
			ids = ids.slice(50);
		}
	}
}
class LabelLoaderQueueItem {
	constructor(callbackSuccess, callbackError) {
		this.callbackSuccess = callbackSuccess;
		this.callbackError = callbackError;
	}
}
class RequestQueue {
	constructor(max) {
		this.max = (max || 5);
		this.nextPointer = 0;
		this.queue = [];
		this.performing = 0;
	}
	enqueueRequest(request) {
		this.queue.push(request);
		this.work();
	}
	work() {
		if(this.max > this.performing) {
			if(typeof this.queue[this.nextPointer] == "undefined") {
				console.debug("Queue finished");
				this.nextPointer = 0;
				this.queue = [];
			} else {
				this.queue[this.nextPointer](this);
				this.performing += 1;
				this.nextPointer += 1;
			}
		}
	}
	_finishRequest() {
		this.performing -= 1;
		this.work();
	}
}
class Settings {
	static attachLiveHandler() {
		$("#setting-ui-stickyheaderrow").change(function(e) {
			if(this.checked) {
				Settings.enableConditionalStyle("stickyheaderrow", `#table-output thead th {
					position: sticky;
					top: 0;
					z-index: 1;
				}`);
			} else {
				Settings.disableConditionalStyle("stickyheaderrow");
			}
		});
		$("#setting-ui-stickyheaderrow").change();
		$("#setting-ui-stickyheadercolumn").change(function(e) {
			if(this.checked) {
				Settings.enableConditionalStyle("stickyheadercolumn", `#table-output tbody th {
					position: sticky;
					left: 0;
				}`);
			} else {
				Settings.disableConditionalStyle("stickyheadercolumn");
			}
		});
		$("#setting-ui-stickyheadercolumn").change();
		$("#setting-ui-visitedlinks").change(function(e) {
			if(this.checked) {
				Settings.enableConditionalStyle("visitedlinks", `a[href^="https://www.wikidata.org/wiki/"]:visited {
					color: purple;
				}`);
			} else {
				Settings.disableConditionalStyle("visitedlinks");
			}
		});
		$("#setting-ui-visitedlinks").change();
	}
	static disableConditionalStyle(name) {
		var element = $(`style[data-setting='${name}']`);
		if(element.length != 0) element.remove();
	}
	static enableConditionalStyle(name, style) {
		if($(`style[data-setting='${name}']`).length == 0) $("head").append(`<style data-setting="${name}">${style}</style>`);
	}
	static export() {
		if($("#button-settings-geturl").hasClass("mode-ready")) {
			var settings = {
				"language-item": $("#setting-language-item").val(),
				"language-search": $("#setting-language-search").val(),
				"ui-collapsealiases": $("setting-ui-collapsealiases").val(),
				"ui-collapsesitelinks": $("#setting-ui-collapsesitelinks").val(),
				"ui-displayimages": $("#setting-ui-displayimages").val(),
				"ui-stickyheadercolumn": $("#setting-ui-stickyheadercolumn").val(),
				"ui-stickyheaderrow": $("#setting-ui-stickyheaderrow").val(),
				"ui-visitedlinks": $("#setting-ui-visitedlinks").val()
			};
			window.location.search = `?settings=${encodeURIComponent(JSON.stringify(settings))}`;
		} else {
			$("#button-settings-geturl").tooltipster({
				content: "Clicking again on this button will redirect you to a new url which has your settings stored. This url can be bookmarked. However, your current entries in the input textbox will be gone once redirected.",
				functionAfter: function() {
					$("#button-settings-geturl").removeClass("mode-ready");
				},
				functionBefore: function() {
					$("#button-settings-geturl").addClass("mode-ready");
				},
				side: "left",
				theme: ["tooltipster-light", "tooltipster-error"],
				timer: 10000,
				trigger: "custom"
			}).tooltipster("open");
		}
	}
	static getLanguage() {
		return $("#setting-language-item").val().toLowerCase();
	}
	static initialize() {
		$("#button-settings-geturl").click(function(e) {
			e.preventDefault();
			Settings.export();
		});

		Settings.loadLanguages();
		Settings.load();
		Settings.attachLiveHandler();
	}
	static load() {
		var query = (new URL(window.location.href)).searchParams.get("settings");
		if(query != null) {
			try {
				var settings = JSON.parse(query);

				if(typeof settings["language-item"] != "undefined") $("#setting-language-item").val(settings["language-item"]);
				if(typeof settings["language-search"] != "undefined") $("#setting-language-search").val(settings["language-search"]);
			} catch(ex) {
				console.warn(ex);
			}
		}
	}
	static loadLanguages() {	// https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities
		var lang = ["aa","ab","ace","ady","ady-cyrl","aeb","aeb-arab","aeb-latn","af","ak","aln","als","am","an","ang","anp","ar","arc","arn","arq","ary","arz","as","ase","ast","atj","av","avk","awa","ay","az","azb","ba","ban","bar","bat-smg","bbc","bbc-latn","bcc","bcl","be","be-tarask","be-x-old","bg","bgn","bh","bho","bi","bjn","bm","bn","bo","bpy","bqi","br","brh","bs","bto","bug","bxr","ca","cbk-zam","cdo","ce","ceb","ch","cho","chr","chy","ckb","co","cps","cr","crh","crh-cyrl","crh-latn","cs","csb","cu","cv","cy","da","de","de-at","de-ch","de-formal","din","diq","dsb","dtp","dty","dv","dz","ee","egl","el","eml","en","en-ca","en-gb","eo","es","es-formal","et","eu","ext","fa","ff","fi","fit","fiu-vro","fj","fo","fr","frc","frp","frr","fur","fy","ga","gag","gan","gan-hans","gan-hant","gcr","gd","gl","glk","gn","gom","gom-deva","gom-latn","gor","got","grc","gsw","gu","gv","ha","hak","haw","he","hi","hif","hif-latn","hil","ho","hr","hrx","hsb","ht","hu","hu-formal","hy","hz","ia","id","ie","ig","ii","ik","ike-cans","ike-latn","ilo","inh","io","is","it","iu","ja","jam","jbo","jut","jv","ka","kaa","kab","kbd","kbd-cyrl","kbp","kea","kg","khw","ki","kiu","kj","kk","kk-arab","kk-cn","kk-cyrl","kk-kz","kk-latn","kk-tr","kl","km","kn","ko","ko-kp","koi","kr","krc","kri","krj","krl","ks","ks-arab","ks-deva","ksh","ku","ku-arab","ku-latn","kum","kv","kw","ky","la","lad","lb","lbe","lez","lfn","lg","li","lij","liv","lki","lmo","ln","lo","loz","lrc","lt","ltg","lus","luz","lv","lzh","lzz","mai","map-bms","mdf","mg","mh","mhr","mi","min","mk","ml","mn","mo","mr","mrj","ms","mt","mus","mwl","my","myv","mzn","na","nah","nan","nap","nb","nds","nds-nl","ne","new","ng","niu","nl","nl-informal","nn","no","nod","nov","nrm","nso","nv","ny","nys","oc","olo","om","or","os","ota","pa","pag","pam","pap","pcd","pdc","pdt","pfl","pi","pih","pl","pms","pnb","pnt","prg","ps","pt","pt-br","qu","qug","rgn","rif","rm","rmy","rn","ro","roa-rup","roa-tara","ru","rue","rup","ruq","ruq-cyrl","ruq-latn","rw","rwr","sa","sah","sat","sc","scn","sco","sd","sdc","sdh","se","sei","ses","sg","sgs","sh","shi","shi-latn","shi-tfng","shn","si","simple","sje","sk","skr","skr-arab","sl","sli","sm","sma","smj","sn","so","sq","sr","sr-ec","sr-el","srn","srq","ss","st","stq","sty","su","sv","sw","szl","ta","tay","tcy","te","tet","tg","tg-cyrl","tg-latn","th","ti","tk","tl","tly","tn","to","tpi","tr","tru","ts","tt","tt-cyrl","tt-latn","tum","tw","ty","tyv","tzm","udm","ug","ug-arab","ug-latn","uk","ur","uz","uz-cyrl","uz-latn","ve","vec","vep","vi","vls","vmf","vo","vot","vro","wa","war","wo","wuu","xal","xh","xmf","yi","yo","yue","za","zea","zh","zh-classical","zh-cn","zh-hans","zh-hant","zh-hk","zh-min-nan","zh-mo","zh-my","zh-sg","zh-tw","zh-yue","zu"];

		$("#languages").html("");
		$.each(lang, function(index, langcode) {
			$("#languages").append(`<option value="${langcode}"></option>`);
		})
	}
}
class TableRow {
	addCell() {

	}
	addTitle(html) {

	}
	getRow() {

	}
}
class Utils {
	static arrayUnique(array) {
		var a = array.concat();
		for(var i=0; i<a.length; ++i) {
			for(var j=i+1; j<a.length; ++j) {
				if(a[i] === a[j])
					a.splice(j--, 1);
			}
		}
	
		return a;
	}
	static copyTextToClipboard(text) {
		var textArea = document.createElement("textarea");

		textArea.style.position = 'fixed';
		textArea.style.top = 0;
		textArea.style.left = 0;
		textArea.style.width = '2em';
		textArea.style.height = '2em';
		textArea.style.padding = 0;
		textArea.style.border = 'none';
		textArea.style.outline = 'none';
		textArea.style.boxShadow = 'none';
		textArea.style.background = 'transparent';
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();

		try {
			document.execCommand('copy');
		} catch(e) {
			console.error(e);
		}

		document.body.removeChild(textArea);
	}
	static validateNumber(i, fallback) {
		return (isNaN(i) ? fallback : i);
	}
}
var elements;
var queue = new RequestQueue();
var labelLoader = new LabelLoader(queue);

jQuery(document).ready(function($) {
	$("#button-parse").removeAttr("disabled").click(function(e) {
		e.preventDefault();
		$(this).attr("disabled", "disabled");

		var userInput_entities = parseUserInput();

		// Reset table
		if(userInput_entities.length > 0) {
			$("#table-output tbody").html("");
			$("#table-output thead tr").html("<th></th>");
		} else {
			$("#table-output thead tr").html(`<th scope="col">&nbsp;</th>`);
			$("#table-output tbody tr").html(`<td>No data</td>`);
			$(this).removeAttr("disabled", "disabled");
			return;
		}

		generateTable(userInput_entities);
	});
	$("a[href='#fullscreen']").click(function(e) {
		e.preventDefault();
		$("#table-container").toggleClass("fullscreen");
	});

	Settings.initialize();
});


function generateTable(elements) {
	var output = "";
	generateColumns(elements);
	getEntities(elements, [], function(e) {
		var allProperties = [];
		if(Object.keys(e).length > 0) {
			// Update entities on UI
			updateEntities(e);

			// Add aliases-rows on UI
			var cells = "";
			var maxlength = 0;
			Object.keys(e).forEach(function(wdId, i) {
				if(typeof e[wdId].aliases != "undefined") {
					var length = 0;
					cells += `<td data-entity="${wdId}"><div><ul>`;
					$.each(e[wdId].aliases, function(i, lang) {
						$.each(lang, function(i, val) {
							cells += `<li>${wdDisplayAlias(val)}</li>`;
							length++;
						});
					});
					cells += `</ul></div></td>`;
					maxlength = length > maxlength ? length : maxlength;
				} else {
					cells += `<td class="state-undefined" data-entity="${wdId}"></td>`;
				}
			});
			output += generateRow("Aliases", null, cells, maxlength, null, $("#setting-ui-collapsealiases")[0].checked)

			// Add sitelink-rows on UI
			cells = "";
			maxlength = 0;
			Object.keys(e).forEach(function(wdId, i) {
				if(typeof e[wdId].sitelinks != "undefined") {
					var length = 0;
					cells += `<td data-entity="${wdId}"><div><ul>`;
					$.each(e[wdId].sitelinks, function(i, val) {
						cells += `<li>${wdDisplaySitelink(val)}</li>`;
						length++;
					});
					cells += `</ul></div></td>`;
					maxlength = length > maxlength ? length : maxlength;
				} else {
					cells += `<td class="state-undefined" data-entity="${wdId}"></td>`;
				}
			});
			output += generateRow("Sitelinks", null, cells, maxlength, null, $("#setting-ui-collapsesitelinks")[0].checked)

			// Add property-rows on UI
			var allProperties = listProperties(e);
			allProperties.forEach(function(property, i) {
				cells = "";
				maxlength = 0;

				Object.keys(e).forEach(function(wdId, i) {
					if(typeof e[wdId].claims != "undefined" && typeof e[wdId].claims[property] != "undefined") {
						var length = 0;
						cells += `<td data-entity="${wdId}"><div><ul>`;
						$.each(e[wdId].claims[property], function(i, val) {
							cells += `<li>${wdDisplayValue(val)}</li>`;
							length++;
						});
						cells += `</ul></div></td>`;
						maxlength = length > maxlength ? length : maxlength;
					} else {
						cells += `<td class="state-undefined" data-entity="${wdId}"></td>`;
					}
				});
				output += generateRow(`<a href="https://www.wikidata.org/wiki/Property:${property}" target="_blank" title="${property}">${property}</a>`, property, cells, maxlength);
			});
			$("#table-output tbody").html(output);

			// Add collapse event handler
			$("#table-container a[href='#collapse']").click(function(e) {
				e.preventDefault();
				$(this).parent().parent().toggleClass("collapsed");
				if($(this).text() == "[–]") {
					$(this).text("[+]");
				} else {
					$(this).text("[–]");
				}
			});
			updateProperties(allProperties);
			labelLoader.startWork();
		} else {
			console.warn("No results");
		}
	});
	function generateColumns(elements) {
		$.each(elements, function(colIndex, wdId) {
			var row = $(`<th scope="col" ${colIndex == 0 ? `class="reference-item"` : ""} data-entity="${wdId}"><a href="https://www.wikidata.org/wiki/${wdId}" target="_blank" title="${wdId}">${wdId}</a></th>`);
			$("#table-output thead tr").append(row);
		});
	}
	function generateRow(title, property, cells, maxElementsInCell, classes, collapsed) {
		collapsed = typeof collapsed == "boolean" && collapsed && maxElementsInCell >= 3;
		return `<tr class="${collapsed ? "collapsed " : ""}${typeof classes == "string" ? classes : ""}"><th scope="row" ${property != null ? `data-entity="${property}"` : ""}>${title}${getCollapseButton()}</th>${cells}</tr>`;

		function getCollapseButton() {
			if(maxElementsInCell >= 3) {
				if(collapsed) {
					return `<a href="#collapse">[+]</a>`;
				} else {
					return `<a href="#collapse">[–]</a>`;
				}
			} else {
				return "";
			}
		}
	}
	
	function updateEntities(entities) {
		Object.keys(entities).forEach(function(val, i) {
			var thisEntity = entities[val];
			console.debug(thisEntity);
			var label = LabelLoader.getLabel(thisEntity.labels);
			$(`th[scope="col"][data-entity="${val}"] a`).text(label == null ? val : label);
		});
	}
	function updateProperties(properties) {
		$.each(properties, function(i, property) {
			labelLoader.enqueueAndReplace(property, $(`th[scope="row"][data-entity="${property}"] a[href^='https://www.wikidata.org/']`).toArray(), property)
		});
	}
	function listProperties(entities) {
		var properties = [];
		Object.keys(entities).forEach(function(wdId, i) {
			var thisEntity = entities[wdId];
			if(typeof thisEntity.claims != "undefined") {
				properties = properties.concat(Object.keys(thisEntity.claims));
			} else {
				console.warn(`Id ${wdId} not found`);
			}					
		});
		return Utils.arrayUnique(properties).sort(function(firstEl, secondEl) {
			var firstNum = parseInt(firstEl.substr(1));
			var secondNum = parseInt(secondEl.substr(1));
			
			if(firstNum < secondNum) {
				return -1;
			} else if(firstNum == secondNum) {
				return 0;
			} else {
				return 1;
			}
		});
	}
}
function getEntities(ids, props, callback, callbackEr, requireFinishAll) {
	idsCopy = ids.slice(0);
	numberOfRequests = Math.floor(ids.length / 50);
	finishedRequests = 0;
	if(typeof requireFinishAll == "undefined") requireFinishAll = true;
	allResults = {};

	while(idsCopy.length > 0) {
		var data = {
			"action": "wbgetentities",
			"format": "json",
			"languages": `${Settings.getLanguage()}|en`,
			"origin": "*",
			"ids": idsCopy.slice(0,50).join("|")
		};
		if(props.length > 0) data.props = props.join("|");
		$.ajax({
			data: data,
			url: "https://www.wikidata.org/w/api.php"
		}).done(function(e) {
			finishedRequests++;
			if(!requireFinishAll && typeof e.entities != "undefined") {
				callback(e.entities);
			} else {
				if(typeof e.entities != "undefined") {
					allResults = mergeResults(e.entities, allResults);
				}
				if(numberOfRequests <= finishedRequests) {
					callback(allResults);
				}
			}
		}).fail(function(e) {
			if(typeof callbackEr != "undefined") callbackEr(e);
			console.error(e);
		});
		idsCopy = idsCopy.slice(50);
	}

	function mergeResults(resNew, resAll) {
		Object.keys(resNew).forEach(function(key) {
			resAll[key] = resNew[key];
		});
		return resAll;
	}
}
function parseUserInput() {
	elements = [];
	$.each($("#commands").val().split("\n"), function(a, b) {
		b = b.replace(/ /, "");
		if(/^Q[0-9]+$/.test(b)) {
			elements.push(b);
		} else {
			console.warn("Invalid user input");
		}
	});
	return elements;
}
function wdDisplayAlias(alias) {
	return `${alias.language} ${alias.value}`;
}
function wdDisplaySitelink(sitelink) {
	if(sitelink.site == "commonswiki") {
		return getLink(`commons.wikimedia.org`);
	} else if(sitelink.site.match(/^(.{2,})wiki$/) != null) {
		var matches = sitelink.site.match(/^(.{2,})wiki$/);
		return getLink(`${matches[1]}.wikipedia.org`);
	} else if(sitelink.site.match(/^(.{2,})(wikibooks|wikinews|wikiquote|wikisource|wikivoyage)$/) != null) {
		var matches = sitelink.site.match(/^(.{2,})(wikibooks|wikinews|wikiquote|wikisource|wikivoyage)$/);
		return getLink(`${matches[1]}.${matches[2]}.org`);		
	} else {
		// @TODO: Fix
		console.warn(`Unknown site ${sitelink.site}`);
		return getLink("example.org");
	}

	function getLink(host) {
		return `<a href="https://${host}/wiki/${encodeURIComponent(sitelink.title)}" target="_blank">${sitelink.site} <small>(${_e(sitelink.title)})</small></a>`;
	}
}
function wdDisplayValue(claim) {
	if(claim.mainsnak.snaktype == "somevalue") {
		return `<em class="snak-somevalue">Some value</em>`;
	} else if(claim.mainsnak.snaktype == "novalue") {
		return `<em class="snak-novalue">No value</em>`;
	} else if(claim.mainsnak.snaktype == "value") {
		if(typeof claim.mainsnak.datatype == "undefined") {
			console.warn(`Errornous mainsnak ${claim.mainsnak}`, claim);
			return `<em class="snak-errornous">Errornous</em>`;
		} else if(claim.mainsnak.datatype == "commonsMedia") {
			return `<a href="https://commons.wikimedia.org/wiki/File:${_e(claim.mainsnak.datavalue.value)}" target="_blank">${_e(claim.mainsnak.datavalue.value)}</a>`;
		} else if(claim.mainsnak.datatype == "external-id") {
			return _e(claim.mainsnak.datavalue.value);
		} else if(claim.mainsnak.datatype == "globe-coordinate") {
			return _e(`${claim.mainsnak.datavalue.value.latitude},${claim.mainsnak.datavalue.value.longitude}`);
		} else if(claim.mainsnak.datatype == "monolingualtext") {
			return `${_e(claim.mainsnak.datavalue.value.text)} <small>(${_e(claim.mainsnak.datavalue.value.language)})</small>`;
		} else if(claim.mainsnak.datatype == "quantity") {
			// @TODO: Get display name
			return `${_e(claim.mainsnak.datavalue.value.amount)} <small>(${_e(claim.mainsnak.datavalue.value.unit)})</small>`;
		} else if(claim.mainsnak.datatype == "string") {
			return _e(claim.mainsnak.datavalue.value);
		} else if(claim.mainsnak.datatype == "time") {
			return _e(`${claim.mainsnak.datavalue.value.time}/${claim.mainsnak.datavalue.value.precision}`);
		} else if(claim.mainsnak.datatype == "url") {
			return `<a href="${_e(claim.mainsnak.datavalue.value)}" target="_blank">${claim.mainsnak.datavalue.value}</a>`;
		} else if(claim.mainsnak.datatype == "wikibase-property") {
			return `<a href="https://www.wikidata.org/wiki/Property:${_e(claim.mainsnak.datavalue.value.id)}" target="_blank" title="${_e(claim.mainsnak.datavalue.value.id)}">${_e(claim.mainsnak.datavalue.value.id)}</a>`;
		} else if(claim.mainsnak.datatype == "wikibase-item") {
			return `<a href="https://www.wikidata.org/wiki/${_e(claim.mainsnak.datavalue.value.id)}" target="_blank" title="${_e(claim.mainsnak.datavalue.value.id)}">${_e(claim.mainsnak.datavalue.value.id)}</a>`;
		} else {
			console.warn(`Unknown datatype ${claim.mainsnak.datatype}`, claim);
			return "<em>Present</em>";
		}
	} else {
		console.warn(`Unknown snaktype ${claim.snaktype}`, claim);
		return "<em>Unknown snaktype</em>";
	}
}
/**
 * Sanitises a given string
 *
 * @param	string	text	Text to sanitise
 * @return	string	Sanitised string
 */
function _e(text) {
	return $('<div/>').text(text).html();
}
