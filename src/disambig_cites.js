/*
 * Copyright (c) 2009 and 2010 Frank G. Bennett, Jr. All Rights
 * Reserved.
 *
 * The contents of this file are subject to the Common Public
 * Attribution License Version 1.0 (the “License”); you may not use
 * this file except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://bitbucket.org/fbennett/citeproc-js/src/tip/LICENSE.
 *
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 14 and 15 have been added to cover use of software over a
 * computer network and provide for limited attribution for the
 * Original Developer. In addition, Exhibit A has been modified to be
 * consistent with Exhibit B.
 *
 * Software distributed under the License is distributed on an “AS IS”
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is the citation formatting software known as
 * "citeproc-js" (an implementation of the Citation Style Language
 * [CSL]), including the original test fixtures and software located
 * under the ./std subdirectory of the distribution archive.
 *
 * The Original Developer is not the Initial Developer and is
 * __________. If left blank, the Original Developer is the Initial
 * Developer.
 *
 * The Initial Developer of the Original Code is Frank G. Bennett,
 * Jr. All portions of the code written by Frank G. Bennett, Jr. are
 * Copyright (c) 2009 and 2010 Frank G. Bennett, Jr. All Rights Reserved.
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU Affero General Public License (the [AGPLv3]
 * License), in which case the provisions of [AGPLv3] License are
 * applicable instead of those above. If you wish to allow use of your
 * version of this file only under the terms of the [AGPLv3] License
 * and not to allow others to use your version of this file under the
 * CPAL, indicate your decision by deleting the provisions above and
 * replace them with the notice and other provisions required by the
 * [AGPLv3] License. If you do not delete the provisions above, a
 * recipient may use your version of this file under either the CPAL
 * or the [AGPLv3] License.”
 */

CSL.Disambiguation = function (state) {
	this.state = state;
	this.sys = this.state.sys;
	this.registry = state.registry.registry;
	this.ambigcites = state.registry.ambigcites;
	this.configModes();
	this.clashes = [1, 0];
};

CSL.Disambiguation.prototype.run = function(akey) {
	if (!this.modes.length) {
		return;
	}
	this.initVars(akey);
	this.runDisambig();
};

CSL.Disambiguation.prototype.runDisambig = function () {
	var pos, len, ppos, llen, pppos, lllen, ismax;
	//
	// length is evaluated inside the loop condition by intention
	// here; items will be added to the list during processing.
	for (pos = 0; pos < this.lists.length; pos += 1) {
		this.nnameset = 0;
		this.gnameset = 0;
		this.gname = 0;
		// each list is scanned repeatedly until all
		// items either succeed or ultimately fail.
		while(this.lists[pos][1].length) {
			this.listpos = pos;
			if (!this.base) {
				this.base = this.lists[pos][0];
			}
			if (this.rerun) {
				this.rerun = false;
			} else {
				this.scanItems(this.lists[pos], 0);
			}
			ismax = this.incrementDisambig();
			this.scanItems(this.lists[pos], 1);
			this.evalScan(ismax);
		}
	}
};

CSL.Disambiguation.prototype.scanItems = function (list, phase) {
	var pos, len, Item, otherItem, ItemCite, otherItemCite, ignore, base;
	Item = list[1][0];
	this.scanlist = list[1];
	this.partners = [];

    var tempResult = this.getItem(Item);
    this.base = tempResult[0];
    this.maxvals = tempResult[1];
    this.minval = tempResult[2];
    ItemCite = tempResult[3];

	this.partners.push(Item);
	this.clashes[phase] = 0;
	this.nonpartners = [];
	for (pos = 1, len = list[1].length; pos < len; pos += 1) {
		otherItem = list[1][pos];
		otherItemCite = this.getItem(otherItem)[3];
		if (ItemCite === otherItemCite) {
			this.clashes[phase] += 1;
			this.partners.push(otherItem);
		} else {
			this.nonpartners.push(otherItem);
		}
	}
};

CSL.Disambiguation.prototype.evalScan = function (ismax) {
	// print("MODE: "+this.modeindex+" "+this.modes);
	this[this.modes[this.modeindex]](ismax);
};

CSL.Disambiguation.prototype.disNames = function (ismax) {
	var pos, len;
	// print("disnames")
	if (this.clashes[1] === 0) {
		// no clashes
		// Remove item from list.  If only one non-clashing item,
		// remove it as well.
		this.state.registry.registerAmbigToken(this.akey, this.partners[0].id, this.base, this.scanlist);
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, this.nonpartners[0].id, this.base, this.scanlist);
			this.lists[this.listpos] = [this.base,[]];
		} else {
			this.lists[this.listpos] = [this.base, this.nonpartners];
		}
	} else if (this.clashes[1] < this.clashes[0]) {
		// fewer clashes
		// requeue nonpartners, and remove them from the list
		this.lists[this.listpos] = [this.base, this.partners];
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, this.nonpartners[0].id, this.base, this.scanlist);
		} else {
			this.lists.push([this.base, this.nonpartners]);
		}
	} else {
		// same number of clashes
		// Everything in the partner set exits if we're at max for this
		// item's base ambig config.
		// Otherwise, allow increment and recycle.
		if (ismax || this.advance_mode) {
			for (pos = 0, len = this.partners.length; pos < len; pos += 1) {
				this.state.registry.registerAmbigToken(this.akey, this.partners[pos].id, this.base, this.scanlist);
			}
			if (ismax) {
				// everything in the nonpartner set is preserved.
				this.lists[this.listpos] = [this.base, this.nonpartners];
			}
		} else {
			this.rerun = true;
		}
	}
};

CSL.Disambiguation.prototype.disGivens = function (ismax) {
	var pos, len;
	// print("disgivens")
	// Haven't compared in detail, but the logic of this seems to the be same
	// as above.
	if (this.clashes[1] === 0) {
		//print("no CLash: "+this.gname)
		// this branch is the same as for disNames(): if it resolves, we're done with it
		this.base = this.decrementNames();
		this.state.registry.registerAmbigToken(this.akey, this.partners[0].id, this.base, this.scanlist);
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, this.nonpartners[0].id, this.base, this.scanlist);
			this.lists[this.listpos] = [this.base,[]];
		} else {
			this.lists[this.listpos] = [this.base, this.nonpartners];
		}
	} else if (this.clashes[1] < this.clashes[0]) {
		// fewer clashes
		this.lists[this.listpos] = [this.base, this.partners];
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, this.nonpartners[0].id, this.base, this.scanlist);
		} else {
			this.lists.push([this.base, this.nonpartners]);
		}
	} else {
		// whether we're at the max value for an individual name.
		// if we are,
		this.base = CSL.cloneAmbigConfig(this.oldbase);
		if (ismax || this.advance_mode) {
			for (pos = 0, len = this.partners.length; pos < len; pos += 1) {
				this.state.registry.registerAmbigToken(this.akey, this.partners[pos].id, this.base, this.scanlist);
			}
			if (ismax) {
				this.lists[this.listpos] = [this.base, this.nonpartners];
			}
		} else {
			this.rerun = true;
		}
	}
};

CSL.Disambiguation.prototype.disExtraText = function () {
	var pos, len;
	// Try with disambiguate="true""
	if (this.clashes[1] === 0) {
		this.state.registry.registerAmbigToken(this.akey, this.partners[0].id, this.base, this.scanlist);
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, this.nonpartners[0].id, this.base, this.scanlist);
			this.lists[this.listpos] = [this.base,[]];
		} else {
			this.lists[this.listpos] = [this.base, this.nonpartners];
		}
	} else {
		this.base.disambiguate = false;
		this.lists[this.listpos] = [this.base, this.lists[this.listpos][1].slice(1)];
	}
};

CSL.Disambiguation.prototype.disYears = function () {
	var pos, len, tokens, token, item;
	// year-suffix
	tokens = [];
	for (pos = 0, len = this.lists[this.listpos][1].length; pos < len; pos += 1) {
		token = this.registry[this.lists[this.listpos][1][pos].id];
		tokens.push(token);
	}
	tokens.sort(this.state.registry.sorter.compareKeys);
	for (pos = 0, len = tokens.length; pos < len; pos += 1) {
		this.state.registry.registerAmbigToken(this.akey, tokens[pos].id, this.base, this.scanlist);
		tokens[pos].disambig.year_suffix = ""+pos;
	}
	this.lists[this.listpos] = [this.base, []];
};

CSL.Disambiguation.prototype.incrementDisambig = function () {
	var val, maxed;
	maxed = false;
	this.oldbase = CSL.cloneAmbigConfig(this.base);
	if (this.advance_mode) {
		this.modeindex += 1;
		this.advance_mode = false;
	}
	if (!maxed && "disNames" === this.modes[this.modeindex]) {
		if (this.base.names[this.nnameset] < this.maxvals[this.nnameset]) {
			this.base.names[this.nnameset] += 1;
		} else {
			if (this.nnameset < (this.base.names.length - 1)) {
				this.nnameset += 1;
			}
			if (this.base.names[this.nnameset] < this.maxvals[this.nnameset]) {
				this.base.names[this.nnameset] += 1;
			}
		}
		if (this.nnameset === (this.base.names.length - 1) && this.base.names[this.nnameset] === this.maxvals[this.nnameset]) {
			if (this.modeindex === (this.modes.length - 1)) {
				return true;
			} else {
				maxed = false;
			}
		}
	}
	if (!maxed && "disGivens" === this.modes[this.modeindex]) {
		if (this.gname < this.maxvals[this.gnameset]) {
			if (this.base.givens[this.gnameset][this.gname] === this.minval) {
				this.base.givens[this.gnameset][this.gname] += 1;
			}
			this.base.givens[this.gnameset][this.gname] += 1;
			this.gname += 1;
		} else {
			if (this.gnameset < (this.base.givens.length - 1)) {
				this.gnameset += 1;
				this.gname = 0;
			}
			if (this.gname < this.maxvals[this.gnameset]) {
				this.base.givens[this.gnameset][this.gname] += 1;
				this.gname += 1;
			}
		}
	}
	if (!maxed && "disExtraText" === this.modes[this.modeindex]) {
		maxed = false;
		this.base.disambiguate = true;
		if (this.modeindex === (this.modes.length - 1)) {
			return true;
		} else {
			maxed = false;
		}
	}
	if (!maxed && "disYears" === this.modes[this.modeindex]) {
		maxed = false;
	}
	if (this.modes[this.modeindex] === "disGivens") {
		if ((this.gnameset === (this.base.names.length - 1) && this.gname === this.maxvals[this.gnameset]) || this.base.names.length === 0) {
				//print("maxed out")
			if (this.modeindex === (this.modes.length - 1)) {
				// print("TOTAL MAX disGivens");
				maxed = true;
			} else {
				this.advance_mode = true;
			}
		}
	}
	if (this.modes[this.modeindex] === "disNames") {
		if ((this.nnameset === (this.base.names.length - 1) && this.base.names[this.nnameset] === this.maxvals[this.nnameset]) || this.base.names.length === 0) {
			if (this.modeindex === (this.modes.length - 1)) {
				// print("TOTAL MAX disNames");
				maxed = true;
			} else {
				this.advance_mode = true;
			}
		}
	}
	return maxed;
};

CSL.Disambiguation.prototype.getItem = function (Item) {
	var str, maxvals, minval, base;
	str = CSL.getAmbiguousCite.call(this.state, Item, this.base);
	maxvals = CSL.getMaxVals.call(this.state);
	minval = CSL.getMinVal.call(this.state);
	base = CSL.getAmbigConfig.call(this.state);
	return [base, maxvals, minval, str];
};

CSL.Disambiguation.prototype.initVars = function (akey) {
	var pos, len;
	var myIds, myItems;
	this.lists = [];
	this.base = false;
	this.akey = akey;
	myItems = [];
	myIds = this.ambigcites[akey];
	// For on-the-fly editing.
	//for (pos = 0, len = myIds.length; pos < len; pos += 1) {
	//	this.state.tmp.taintedItemIDs[myIds[pos]] = true;
	//}
	if (myIds && myIds.length > 1) {
		for (pos = 0, len = myIds.length; pos < len; pos += 1) {
			myItems.push(this.state.retrieveItem(myIds[pos]));
		}
		// first element is the base disambig, which is false for the initial
		// list.
		this.lists.push([this.base, myItems]);
	}
	this.modeindex = 0;
};

/**
 * Set available modes for disambiguation
 */
CSL.Disambiguation.prototype.configModes = function () {
	var dagopt, gdropt;
	// Modes are function names prototyped to this instance.
	this.modes = [];
	if (this.state.opt["disambiguate-add-names"]) {
		this.modes.push("disNames");
	}
	dagopt = this.state.opt["disambiguate-add-givenname"];
	gdropt = this.state.opt["givenname-disambiguation-rule"];
	if (dagopt && gdropt === "by-cite") {
		this.modes.push("disGivens");
	}
	if (this.state.opt.has_disambiguate) {
		this.modes.push("disExtraText");
	}
	if (this.state.opt["disambiguate-add-year-suffix"]) {
		this.modes.push("disYears");
	}
};

CSL.Disambiguation.prototype.decrementNames = function () {
	var base_return, do_me, i, j, pos, len, ppos, llen, ids;
	// This band-aid is needed for disGivens, to prevent name
	// overruns when an initial or givenname is belatedly
	// found to be sufficient for disambiguation.
	//
	// Two reverse scans, one to determine if there are any expanded
	// names to stop the unwind, and another to perform the
	// unwind
	base_return = CSL.cloneAmbigConfig(this.base);
	do_me = false;
	len = base_return.givens.length - 1;
	for (pos = len; pos > -1; pos += -1) {
		llen = base_return.givens[pos].length - 1;
		for (ppos = llen; ppos > -1; ppos += -1) {
			if (base_return.givens[pos][ppos] > this.oldbase.givens[pos][ppos]) {
				do_me = true;
			}
		}
	}
	if (do_me) {
		len = base_return.givens.length - 1;
		for (pos = len; pos > -1; pos += -1) {
			llen = base_return.givens[pos].length - 1;
			for (ppos = llen; ppos > -1; ppos += -1) {
				if (base_return.givens[pos][ppos] > this.oldbase.givens[pos][ppos]) {
					break;
				}
				// Be careful to treat the givens and names
				// arrays in step.  Fixes bug affecting
				// disambiguate_AllNamesBaseNameCountOnFailureIfYearSuffixAvailable
				if (ppos < base_return.names[pos]) {
					base_return.names[pos] += -1;
				}
			}
		}
	}
	return base_return;
};
