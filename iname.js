/**
 * @license
 * Copyright (c) 2016 spica.tokyo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * @author m-kudo
 * @version 1.3
 */
(function(){
"use strict";

///----------------------------------------------------------------------
/// private
///----------------------------------------------------------------------
/**
 * @description ただの型判定
 * @param {*} target 判定対象
 * @param {String} pattern 型（|区切りで複数指定可）
 * @returns {Boolean}
 * @example 
 *	TypeMatch("a", "string") -> true
 *	TypeMatch({}, "function") -> false
 *	TypeMatch([], "array|number") -> true
 *	TypeMatch(1, typeof 1 + "|" + typeof "") -> true
 */
var TypeMatch = function(target, pattern){
	if(pattern instanceof RegExp){ return Object.prototype.toString.call(target).match(pattern) ? true : false; }
	return Object.prototype.toString.call(target).match(new RegExp('\\[object ('+pattern+')\\]', 'i')) ? true : false;
};

/**
 * @description thisに対して引数のオブジェクトを結合する（属性も）
 *  exinherit.apply(this, arguments) 等でthisのオブジェクトを明示して使うのです。
 *  {_define_:{}} が結合オブジェクトの場合definePropertyで定義される。
 * @returns {undefined}
 */
var exinherit = function(){
	var src = this,
		dst = arguments[0],
		len = arguments.length;
	for(var i = 0; i < len && dst != null; dst = arguments[++i]){
		for(var key in dst){
			if(src[key] === dst[key]){ continue; }

			///※あんましエレガントじゃないが……。
			/// dstに _define_:{} というメンバがあったら、definePropertyでsrcに定義する。
//			if(dst[key] instanceof Object && dst[key].hasOwnProperty("_define_")){
//				Object.defineProperty(src, key, dst[key]["_define_"]);
//			}
//			else if(src[key] instanceof Object && TypeMatch(dst[key], "object|array")){
			if(src[key] instanceof Object && TypeMatch(dst[key], "object|array")){
				src[key] = exinherit.call(src[key], dst[key]);
			}
			else if(src[key] === undefined){
				Object.defineProperty(src, key, Object.getOwnPropertyDescriptor(dst, key));
			}
		}
	}
	return this;
};

var exinherit_by_define = function(){
	var src = this,
		dst = arguments[0],
		len = arguments.length;
	for(var i = 0; i < len && dst != null; dst = arguments[++i]){
		for(var key in dst){
			if(src[key] === dst[key]){ continue; }

			if(dst[key] instanceof Object){
				Object.defineProperty(src, key, dst[key]);
			}
		}
	}
	return this;
};


/**
 * @description おまけ（蛇足）
 * 同じ系統のコンストラクタを持つオブジェクトのメンバ参照をインスタンスに設定する
 * 第一引数がundefinedでなく同じ系統のコンストラクタでもない場合はなにもしない。
 * インスタンス作成時に同系統の名前空間のインスタンスが第一引数だった場合に、
 * そのオブジェクトのメンバを参照できるようコピーして、第一引数を削除する
 * 第一引数がundefinedの場合は、メンバの参照はもちろんできないがその第一引数の削除のみ行う
 * @param {type} _super_ 参照するインスタンス
 * @returns {Array} arguments 条件次第で第一引数が削除されている
 */
/*
var _reference_instance_ = function(_super_){
	//thisが継承先としてcallされている
	//undefinedなら継承しない。しかし第一引数の削除は行う
	if(typeof _super_ === typeof undefined) { return Array.apply(null,arguments).slice(1); }
	//undefinedいがいの
	else if(typeof _super_ !== "object" || !(this instanceof _super_.constructor)){ return arguments; }

	//継承して第一引数を削除
	exinherit.call(this, _super_);
	return Array.apply(null,arguments).slice(1);
};
*/


/**
 * @description 関数の名付け。call実行。privateなんで例外処理とかしません。
 * @param {string} _name 変数名指定
 * @returns {Function}
 */
var named = function(_name){
	return (new Function("return function(c){return function " + _name + "(){return c(this, arguments);};};")())(Function.apply.bind(this));
};
/**
 * @description 関数の名付け。call実行。privateなんで例外処理とかしません。
 * @param {string} _name 変数名指定
 * @param {boolean} _origin 真の場合はただの名前変更。偽の場合、戻り値の関数には元の関数に「第一引数が同じ名前空間のコンストラクタを持つオブジェクトだったら、そのメンバの参照設定をする」いう機能を追加。
 *	という機能を追加。
 * @returns {Function}
 */
//var named = function(_name, _origin){
//	return (new Function("return function(c,r){return function " + _name + "(){return c(this," + (_origin ? "arguments" : "r.apply(this,arguments)") + ");};};")())(Function.apply.bind(this), _reference_instance_);
//};

/**
 * @description 名前空間の構築。プロトタイプチェーンの構築。
 * @param {type} _parent
 * @param {type} _spaces
 * @returns {undefined}
 */
var chain = function(_parent, _spaces){
	//※引数のエラーチェックは呼び出し元でやっている

	var node = _parent;
	var edge_node = _parent;
	for(var spacename in _spaces){
		if(!_parent.hasOwnProperty(spacename)){
			_parent[spacename] = named.call(
				(typeof _spaces[spacename] === "function") ? _spaces[spacename] : function(){}
				, spacename
			);
		}

		//スーパークラスの継承と_super_メンバの定義。
		//rootはinameの継承で固定。 ※function本体はwindow直下に配置されます
		var _super = (_parent === window ? iname : _parent);
		//Object.setPrototypeOf(_parent[spacename].prototype, _super.prototype);
		//Object.setPrototypeOf(_parent[spacename], _super.prototype);
		Object.setPrototypeOf(_parent[spacename], _super);
		//Object.defineProperty(_parent[spacename].prototype, "_super_", { value: _super, enumerable: false, configurable: false });

		///再帰
		if(typeof _parent[spacename] === "function" && _parent[spacename].hasOwnProperty("name")){
			edge_node = _parent[spacename];
			chain(_parent[spacename], _spaces[spacename]);
		}
	}
	return edge_node;


/*
	var keys = Object.keys(space);
	if(keys.length === 0){ return; }
	var edge_node = parent;
	keys.forEach(function(spacename){
		if(!parent.hasOwnProperty(spacename)){
			if(typeof space[spacename] === "function"){
				//parent[spacename] = space[spacename].named(spacename);
				parent[spacename] = named.call(space[spacename], spacename);
			}else{
				//parent[spacename] = (function(){}).named(spacename);
				parent[spacename] = named.call(function(){}, spacename);
			}
			
			//子に対し、
			//parentがwindowの場合は名前空間のルート用プロトタイプ。
			//windowでなければfunctionなのでそのプロタイプを設定する。
			(function(_sub, _super){
				Object.setPrototypeOf(_sub.prototype, _super.prototype);
				///↓functionメンバとして_super_に親functionを設定。
				///  ns_rootのprototypeにdefinePropertyで設定している_super_でも取得できるスーパークラスを指す
				Object.defineProperty(_sub, "_super_", { value: _super, configurable: false });
			//})(parent[spacename], (parent instanceof Window ? window.ns : parent));
			})(parent[spacename], (parent instanceof Window ? window.iname : parent));
		}
		else{
			console.warn("Conflict namespace '" + spacename + "'");
		}

		if(typeof parent[spacename] === "function" && parent[spacename].hasOwnProperty("name")){
			edge_node = parent[spacename];
			chain(parent[spacename], space[spacename]);
		}
	});
	return edge_node;
*/
//	};
};

/**
 * @description 名前空間の構築。プロトタイプチェーンの構築。
 * @param {object} _parent
 * @param {Array} _spaces
 * @returns {function}
 */
var _chain = function(_parent, _spaces){
	var node = _parent;
	for(var index = 0; index < _spaces.lengh; index++){
		var name = _spaces[index];

	}




	var node = _parent;
	var edge_node = _parent;
	for(var spacename in _spaces){
		if(!_parent.hasOwnProperty(spacename)){
			_parent[spacename] = named.call(
				(typeof _spaces[spacename] === "function") ? _spaces[spacename] : function(){}
				, spacename
			);
		}

		//スーパークラスの継承と_super_メンバの定義。
		//rootはinameの継承で固定。 ※function本体はwindow直下に配置されます
		var _super = (_parent === window ? iname : _parent);
		//Object.setPrototypeOf(_parent[spacename].prototype, _super.prototype);
		//Object.setPrototypeOf(_parent[spacename], _super.prototype);
		Object.setPrototypeOf(_parent[spacename], _super);
		//Object.defineProperty(_parent[spacename].prototype, "_super_", { value: _super, enumerable: false, configurable: false });

		///再帰
		if(typeof _parent[spacename] === "function" && _parent[spacename].hasOwnProperty("name")){
			edge_node = _parent[spacename];
			chain(_parent[spacename], _spaces[spacename]);
		}
	}
	return edge_node;
};


/**
 * @description 名前空間の定義（の準備。実際の構築はchainが行う）
 *  ※このfunctionが名前空間として定義されるfunctionのプロトタイプとなる
 * @param {string} _namespace
 * @param {function} _constructor
 * @returns {parent|Window.ns.edge_node|Window|Window.ns.parent|window}
 */
//var ns_constructor_origin = function(_space, _constructor){
//function iname (_space, _constructor){
//function iname (_namespace, _constructor){
function iname(_namespace, _constructor){
//	if(!(this instanceof iname)){ return new iname(_namespace, _constructor); }

	if((typeof _namespace !== "string") || _namespace.length === 0){ throw new Error("illegal namspace"); }
	//if( !TypeMatch(_namespace, "string|object") ){ throw new Error("illegal namspace"); }
	if(typeof _constructor !== "function"){ _constructor = function(){}; }
	//_constructor = _constructor || function(){}; 
	//if( typeof _constructor !== "function" ){ _constructor = null; }

	///名前空間のroot functionはinameを継承する（exetnd, define, append が継承される）	
	//Object.setPrototypeOf(_constructor.prototype, iname.prototype);

	//名前空間文字列を構築用のオブジェクト階層に変換
	//@example "parent.child" -> {parent:{child:{}}
	//if(_namespace.length === 0){ throw new Error("empty namspace"); }




	var node = window;
	var spaces = _namespace.split(".");
	for(var index = 0; index < spaces.length; index++){
		var spacename = spaces[index];
		if( !node.hasOwnProperty(spacename) ){
			node[spacename] = named.call((index < (spaces.length - 1)) ? function(){} : _constructor, spacename);
		}
		var _super = (node === window ? iname : node);
		//Object.setPrototypeOf(node[spacename].prototype, _super.prototype);
		//Object.setPrototypeOf(node[spacename], _super.prototype);
		//Object.setPrototypeOf(node[spacename], Object.create(_super));
		Object.setPrototypeOf(node[spacename], _super);

		//Object.defineProperty(node[spacename].prototype, "_super_", { value: _super, enumerable: false, configurable: false });

		node = node[spacename];
	}

	return node;

/*
	var spaces = _namespace.split(".");
	var tree = {};
	for(var index=0, ref=tree; index < spaces.length; index++){
		var key=spaces[index];
		ref[key] = (index === (spaces.length-1) ? _constructor : function(){});
		ref = ref[key]
	}
	return chain(window, tree); ///chainの基底オブジェクトはwindow
*/

	//_namespace = _tree;
	//	return chain(window, _namespace); ///chainの基底オブジェクトはwindow
};

Object.setPrototypeOf(iname, {
	"extend":function(){
			if(this == null || this instanceof Window){ return exinherit.apply({}, arguments); }
			else if(this instanceof Function){ return exinherit.apply(this.prototype, arguments); }
			else{ return exinherit.apply(this.prototype, arguments); }
	},
	"define": function(){
		if(this == null || this instanceof Window){ return exinherit_by_define.apply({}, arguments); }
		else if(this instanceof Function){ return exinherit_by_define.apply(this.prototype, arguments); }
		else{ return exinherit_by_define.apply(this.prototype, arguments); }
	},
	"append": function(){
		exinherit.apply(this, arguments);
		return this;
	}
});

Object.defineProperty(iname, "extend", {
	value: function(){
			if(this == null || this instanceof Window){ return exinherit.apply({}, arguments); }
			else if(this instanceof Function){ return exinherit.apply(this.prototype, arguments); }
			else{ return exinherit.apply(this.prototype, arguments); }
	},
	enumerable: false,
	configurable: false
});
Object.defineProperty(iname, "define", {
	value: function(){
		if(this == null || this instanceof Window){ return exinherit_by_define.apply({}, arguments); }
		else if(this instanceof Function){ return exinherit_by_define.apply(this.prototype, arguments); }
		else{ return exinherit_by_define.apply(this.prototype, arguments); }
	},
	enumerable: false,
	configurable: false
});
Object.defineProperty(iname, "append", {
	value: function(){
		exinherit.apply(this, arguments);
		return this;
	},
	enumerable: false,
	configurable: false
});
/*
Object.defineProperty(iname.prototype, "extend", {
	value: function(){
			if(this == null || this instanceof Window){ return exinherit.apply({}, arguments); }
			else if(this instanceof Function){ return exinherit.apply(this.prototype, arguments); }
			else{ return exinherit.apply(this.prototype, arguments); }
	},
	enumerable: false,
	configurable: false
});
Object.defineProperty(iname.prototype, "define", {
	value: function(){
		if(this == null || this instanceof Window){ return exinherit_by_define.apply({}, arguments); }
		else if(this instanceof Function){ return exinherit_by_define.apply(this.prototype, arguments); }
		else{ return exinherit_by_define.apply(this.prototype, arguments); }
	},
	enumerable: false,
	configurable: false
});
Object.defineProperty(iname.prototype, "append", {
	value: function(){
		exinherit.apply(this, arguments);
		return this;
	},
	enumerable: false,
	configurable: false
});
Object.defineProperty(iname.prototype, "_super_", {
	get: function(){ return this.constructor["_super_"]; },
//	get: function(){ return this.constructor["_super_"]; },
	enumerable: false,
	configurable: false
});
*/
/*
//ns_constructor_origin.prototype.extend = function(){
iname.prototype.extend = function(){
	if(this == null || this instanceof Window){ return exinherit.apply({}, arguments); }
	else if(this instanceof Function){ return exinherit.apply(this.prototype, arguments); }
	else{ return exinherit.apply(this.prototype, arguments); }
};
*/

/*
//ns_constructor_origin.prototype.define = function(){
iname.prototype.define = function(){
	if(this == null || this instanceof Window){ return exinherit_by_define.apply({}, arguments); }
	else if(this instanceof Function){ return exinherit_by_define.apply(this.prototype, arguments); }
	else{ return exinherit_by_define.apply(this.prototype, arguments); }
}
*/

/**
 * @description functionのメンバにオブジェクトをマージする
 * @param {type} _prototype
 * @returns {undefined}
 */
//Function.prototype.defineMember = function(){
//ns_constructor_origin.prototype.append = function(){
/*
iname.prototype.append = function(){
	if(typeof this !== typeof Function){ throw new Error("defineMember called illegal instance."); }
	exinherit.apply(this, arguments);
	return this;
};
*/


///----------------------------------------------------------------------
/// public
///----------------------------------------------------------------------
Object.defineProperty(window, "iname", {
	configurable: false, enumerable: false, writable: true,
	value: named.call(iname, "iname")
	//named.call(iname, "iname", true)
	//value: named.call(ns_constructor_origin, "iname", true)
});

/**
 * @description namespaceのルート（window直下）のプロトタイプ。
 * 名前空間オブジェクト全体に継承したい機能はwindow.nsのprototypeに定義していく。
 *  exinherit.call(window.ns, {追加したい機能や値などのオブジェクト}) としても良い。
 */
/*
Object.defineProperty(window["iname"].prototype, "_super_", {
	get: function(){ return this.constructor["_super_"]; },
	enumerable: false,
	configurable: false
});
*/

///名前空間とそのコンストラクタとしてのfunction定義
//Function.prototype["iname"] = function(_space){ return window["iname"].call(this, _space); };


/**
 * @description functionのprototypeにオブジェクトをマージする
 * @param {type} _prototype
 * @returns {undefined}
 */
/*
Function.prototype.extend = function(){
	if(this == null || this instanceof Window){ return exinherit.apply({}, arguments); }
	else if(this instanceof Function){ return exinherit.apply(this.prototype, arguments); }
	else{ return exinherit.apply(this.prototype, arguments); }
};


Function.prototype.define = function(){
	if(this == null || this instanceof Window){ return exinherit_by_define.apply({}, arguments); }
	else if(this instanceof Function){ return exinherit_by_define.apply(this.prototype, arguments); }
	else{ return exinherit_by_define.apply(this.prototype, arguments); }
};
*/

/**
 * @description functionのメンバにオブジェクトをマージする
 * @param {type} _prototype
 * @returns {undefined}
 */
/*
Function.prototype.append = function(){
	exinherit.apply(this, arguments);
	return this;
};
*/

})();
