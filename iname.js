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
 * 		結合するオブジェクトのバージョンを指定した場合、結合メンバー名が衝突したときに上書きするかどうか判定する。
 * 		※バージョン指定呼び出しは未実装
 * @param {function|object} dst 結合元
 * @param {boolean} isUpperVersion 結合するオブジェクトのバージョンが結合先よりも新しいかどうか
 * @param {boolean} byDefine definePropertyで結合するかどうか
 * @returns {function|object} thisを返す 
 */
var exinherit = function(dst, isUpperVersion, byDefine){
		var src = this;
		for(var key in dst){
			///prototypeの固有メンバに同名のメンバがないか、srcのバージョンがdst未満の場合は上書き・挿入確定
			if(!src.hasOwnProperty(key) || isUpperVersion){
				if(byDefine && dst[key] instanceof Object){
					Object.defineProperty(src, key, dst[key]);
				}else{
					Object.defineProperty(src, key, Object.getOwnPropertyDescriptor(dst, key));
				}
			}
			///同名の固有メンバがあるが、objectの場合は下位メンバも走査するため再帰へ。
			else if( src[key] instanceof Object && TypeMatch(dst[key], "object|function") ){
				src[key] = exinherit.call(src[key], dst[key], isUpperVersion, byDefine);
			}
		}
	return this;
};


/**
 * @description 関数の名付け。call実行。privateなんで例外処理とかしません。
 * @param {string} _name 変数名指定
 * @returns {Function}
 */
var named = function(_name){
	return (new Function("return function(c){return function " + _name + "(){return c(this, arguments);};};")())(Function.apply.bind(this));
};


/**
 * @description 名前空間の定義（の準備。実際の構築はchainが行う）
 *  ※このfunctionが名前空間として定義されるfunctionのプロトタイプとなる
 * @param {string} _namespace
 * @param {function} _constructor
 * @returns {parent|Window.ns.edge_node|Window|Window.ns.parent|window}
 */
var _iname = named.call(
	function (_namespace, _constructor, _version){
		if(this instanceof window["iname"]){ return this; } /// new iname(...) されたとき。

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

		var ver = -1;
		if(TypeMatch(_version, "string|number")){ ver = _version; }

		var node = window;
		var spaces = _namespace.split(".");
		for(var index = 0; index < spaces.length; index++){
			var spacename = spaces[index];
			if( !node.hasOwnProperty(spacename) ){
				///名前空間の末端（指定コンストラクタの階層）
				if(index === (spaces.length - 1)){
					node[spacename] = named.call(_constructor, spacename);
					//Object.defineProperty(node[spacename], "_ver_", { value: ver, enumerable: false, configurable: false});
				}
				///名前空間の途中経路経路
				else{
					node[spacename] = named.call(function(){}, spacename);
				}

				if(node === window){
					///名前空間functionにinameを継承。
					Object.setPrototypeOf(node[spacename], new window["iname"]());
				}else{
					///名前空間functionに上位階層の名前空間を継承。
					Object.setPrototypeOf(node[spacename], node);

					///通常の上位クラスのprototypeを下位クラスに継承
					Object.setPrototypeOf(node[spacename].prototype, node.prototype);
					///スーパークラスを取得するメンバを追加
					Object.defineProperty(node[spacename], "_super_", { value: node, enumerable: false, configurable: false });
				}
			}
			else if(typeof node[spacename] !== "function"){
				new Error('Conflict member "' + spacename + '"');
			}
			node = node[spacename];
		}
		return node;
	}
	, "iname"
);


/**
 * @description exinheritに渡すための引数を設定する
 * @type {object} src
 * @type {arguments} args
 * @returns {object}
 */
var setExinheritDest = function(src, args){
	var res = {dst: [], isUpperVersion: null};
	if(!src.hasOwnProperty("_ver_")){ src["_ver_"] = -1; }

	for(var i = 0, arg = args[0]; i < args.length; arg = args[++i]){
		if(TypeMatch(arg, "object|function")){
			res.dst.push(arg);
		}
		else if(res.isUpperVersion === null && TypeMatch(arg, "string|number")){
			if(src["_ver_"] < arg){
				res.isUpperVersion = true;
				src["_ver_"] = arg;
			}
		}
	}
	if(res.isUpperVersion === null){ res.isUpperVersion = false; }
	return res;
};
var callExinherit = function(_args, _byDefine, _append){
		var args = setExinheritDest(this, _args);
		args.dst.forEach((function(_dst){
			exinherit.call(_append ? this : this.prototype, _dst, args.isUpperVersion, _byDefine);
		}).bind(this));
		return this;
};


///----------------------------------------------------------------------
/// public
///----------------------------------------------------------------------
///名前空間funtion（iname継承）の機能
///prototypeへの追加
Object.defineProperty(_iname.prototype, "extend", {
	value: function(){ return callExinherit.call(this, arguments, false, false); },
	enumerable: false, configurable: false
});
///prototypeへのdefineProperty
Object.defineProperty(_iname.prototype, "exdef", {
	value: function(){ return callExinherit.call(this, arguments, true, false); },
	enumerable: false, configurable: false
});
///オブジェクトメンバへの追加
Object.defineProperty(_iname.prototype, "append", {
	value: function(){ return callExinherit.call(this, arguments, false, true); },
	enumerable: false, configurable: false
});
///オブジェクトメンバへのdefineProperty
Object.defineProperty(_iname.prototype, "apdef", {
	value: function(){ return callExinherit.call(this, arguments, true, true); },
	enumerable: false, configurable: false
});

///globalへinameを公開
Object.defineProperty(window, "iname", {
	value: _iname,
	enumerable: false, configurable: false
});

})();
