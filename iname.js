/**
 * @license
 * Copyright (c) 2016 garden-soft.com, studio-wiz.com, spica.tokyo.
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
	var src = this, ///functionだったらprototypeを……と思ったけどそれは呼び出し元でオナシャス
		dst = arguments[0],
		len = arguments.length;
	for(var i = 0; i < len && dst != null; dst = arguments[++i]){
		for(var key in dst){
			if(src[key] === dst[key]){ continue; }

			///※あんましエレガントじゃないが……。
			/// dstに _define_:{} というメンバがあったら、definePropertyでsrcに定義する。
			if(dst[key] instanceof Object && dst[key].hasOwnProperty("_define_")){
				Object.defineProperty(src, key, dst[key]["_define_"]);
			}
			else if(src[key] instanceof Object && TypeMatch(dst[key], "object|array")){
				src[key] = exinherit.call(src[key], dst[key]);
			}
			else if(src[key] === undefined){
				Object.defineProperty(src, key, Object.getOwnPropertyDescriptor(dst, key));
			}
		}
	}
	return this;
};

/**
 * @description おまけ
 * 同じ系統のコンストラクタを持つオブジェクトのメンバ参照をインスタンスに設定する
 * 第一引数がundefinedでなく同じ系統のコンストラクタでもない場合はなにもしない。
 * インスタンス作成時に同系統の名前空間のインスタンスが第一引数だった場合に、
 * そのオブジェクトのメンバを参照できるようコピーして、第一引数を削除する
 * 第一引数がundefinedの場合は、メンバの参照はもちろんできないがその第一引数の削除のみ行う
 * @param {type} _super_ 参照するインスタンス
 * @returns {Array} arguments 条件次第で第一引数が削除されている
 */
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

/**
 * @description 関数の名付け。call実行。privateなんで例外処理とかしません。
 * @param {string} _name 変数名指定
 * @param {boolean} _origin 真の場合はただの名前変更。偽の場合、戻り値の関数には元の関数に「第一引数が同じ名前空間のコンストラクタを持つオブジェクトだったら、そのメンバの参照設定をする」いう機能を追加。
 *	という機能を追加。
 * @returns {Function}
 */
var named = function(_name, _origin){
	return (new Function("return function(c,r){return function " + _name + "(){return c(this," + (_origin ? "arguments" : "r.apply(this,arguments)") + ");};};")())(Function.apply.bind(this), _reference_instance_);
};

/**
 * @description 名前空間の構築。プロトタイプチェーンの構築。
 * @param {type} parent
 * @param {type} space
 * @returns {undefined}
 */
var chain = function(parent, space){
	//エラーチェック
	if(!TypeMatch(parent, "window|function")){ console.warn("Illegal super class."); return null; }
	else if(!(space instanceof Object)){ console.warn("Illegal namespace."); return; }

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
			})(parent[spacename], (parent instanceof Window ? window.ns : parent));
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
//	};
};





///----------------------------------------------------------------------
/// public
///----------------------------------------------------------------------
Object.defineProperty(window, "ns", {
	configurable: false, enumerable: false, writable: true,
	value: named.call(
	/**
	 * @description 名前空間の定義（の準備。実際の構築はchainが行う）
	 *  ※このfunctionが名前空間として定義されるfunctionのプロトタイプとなる
	 * @param {type} _space
	 * @param {type} _constructor
	 * @returns {parent|Window.ns.edge_node|Window|Window.ns.parent|window}
	 */
	function(_space, _constructor){
		if( !TypeMatch(_space, "string|object") ){ console.warn("ns fail"); return null; }
		if( typeof _constructor !== "function" ){ _constructor = null; }

		//名前空間文字列を構築用のオブジェクト階層に変換
		//@example "parent.child" -> {parent:{child:{}}
		if(typeof _space === "string" || _space.length > 0){
			var _space_array = _space.split(".");
			var node_len = _space_array.length;
			var root = {};
			var ref = root;
			_space_array.forEach(function(key, index){
				//コンストラクタがあり名前空間の終端の場合はコンストラクタを。それ以外はオブジェクト。
				ref[key] = (_constructor && (index === node_len - 1)) ? _constructor : {};
				ref = ref[key];
			});
			_space = root;
		}
		return chain((typeof this === "function" ? this : window), _space);
	}, "ns", true)
});

/**
 * @description namespaceのルート（window直下）のプロトタイプ。
 * 名前空間オブジェクト全体に継承したい機能はwindow.nsのprototypeに定義していく。
 *  exinherit.call(window.ns, {追加したい機能や値などのオブジェクト}) としても良い。
 */
Object.defineProperty(window["ns"].prototype, "_super_", {
	get: function(){ return this.constructor["_super_"]; },
	//set: function(){}, ///代入しようとしてもなにもしない
	enumerable: false,
	configurable: false
});

///名前空間とそのコンストラクタとしてのfunction定義
Function.prototype["ns"] = function(_space){ return window["ns"].call(this, _space); };


/**
 * @description functionのprototypeにオブジェクトを設定する
 * @param {type} _prototype
 * @returns {undefined}
 */
Function.prototype.defineProto = function(){
//	if(this == null || this instanceof Window){ return inherits.apply({}, arguments); }
//	else{ return inherits.apply(this, arguments); }
	
	//if(typeof this !== typeof Function){ throw new Error("defineProto called illegal instance."); }
	if(this == null || this instanceof Window){ return exinherit.apply({}, arguments); }
	else if(this instanceof Function){ return exinherit.apply(this.prototype, arguments); }
	else{ return exinherit.apply(this.prototype, arguments); }
	//else{ return exinherit.apply(this, arguments); }
	//inherits.apply(this, arguments); //_prototypeを継承する
	//inherits.call(this, _prototype); //_prototypeを継承する
};
Function.prototype.proto = Function.prototype.defineProto;

//Function.prototype.defineMember = function(_static_property){
Function.prototype.defineMember = function(){
	if(typeof this !== typeof Function){ throw new Error("defineMember called illegal instance."); }
	exinherit.apply(this, arguments);
	return this;
	
//	_static_property = _static_property || {};
//	if(typeof _static_property === "object"){
//		for(var p in _static_property){ this[p] = _static_property[p]; }
//	}
//	return this;
};
Function.prototype.global = Function.prototype.defineMember;

})();
