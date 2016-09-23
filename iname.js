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
 * @version 1.4.1
 */
(function(){
"use strict";

///----------------------------------------------------------------------
/// private
///----------------------------------------------------------------------
/**
 * @description ただの型判定
 * @param {*} target 判定対象
 * @param {String|<RegExp>} pattern 正規表現
 * @returns {Boolean}
 * @example 
 *	TypeMatch("a", "string") // true
 *	TypeMatch({}, "function") // false
 *	TypeMatch([], "array|number") // true
 *	TypeMatch(1, typeof 1 + "|" + typeof "") // true
 */
var TypeMatch = function(target, pattern){
	if(pattern instanceof RegExp){ return Object.prototype.toString.call(target).match(pattern) ? true : false; }
	return Object.prototype.toString.call(target).match(new RegExp('\\[object ('+pattern+')\\]', 'i')) ? true : false;
};

/**
 * @description 関数の名付け。thisが名付け対象のfunctionになるように実行する。※ちゃんと使う前提で例外処理とかしない。
 * @param {string} _name 変数名指定
 * @returns {function}
 */
var named = function(_name){
	return (new Function("return function(c){return function " + _name + "(){return c(this, arguments);};};")())(Function.apply.bind(this));
};

/**
 * @description thisに対して引数のオブジェクトを結合する（属性も）
 * 		結合するオブジェクトのバージョンを指定した場合、結合メンバー名が衝突したときに上書きするかどうか判定する。
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
 * @description exinheritに渡すための引数を設定する
 * @type {object} src
 * @type {arguments} args
 * @returns {object}
 */
var setExinheritArgs = function(src, args){
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
/**
 * @description exinherit呼び出し用。thisは要素設定先の名前空間function。
 * @type {arguments} _args public呼び出し時のarguments
 * @type {boolean} _byDefine definePropertyで子要素設定するかどうか
 * @type {boolean} _append functionのメンバ直下に要素設定するかどうか
 * @returns {object} thisを返します
 */
var callExinherit = function(_args, _byDefine, _append){
		var args = setExinheritArgs(this, _args);
		args.dst.forEach((function(_dst){
			exinherit.call(_append ? this : this.prototype, _dst, args.isUpperVersion, _byDefine);
		}).bind(this));
		return this;
};


/**
 * @description 名前空間functionの定義
 * @param {string} _namespace
 * @param {function} _constructor
 * @returns {function} 名前空間として作成されたfunction
 */
function iname(_namespace, _constructor){
	if(this instanceof iname){ return this; } /// new iname(...) されたとき。
	if((typeof _namespace !== "string") || _namespace.length === 0){ throw new Error("Illegal namspace"); }
	_constructor = _constructor || function(){};
	if(typeof _constructor !== "function"){ throw new Error("Illegal constructor"); }

	var node = window;
	var spaces = _namespace.split(".");
	for(var index = 0; index < spaces.length; index++){
		var spacename = spaces[index];
		if( !node.hasOwnProperty(spacename) ){
			///名前空間の末端（指定コンストラクタの階層） -> _constructor
			///名前空間の途中経路経路 -> function(){}
			node[spacename] = named.call((index===(spaces.length-1)) ? _constructor : function(){}, spacename);

			if(node === window){
				///名前空間functionにinameを継承。
				Object.setPrototypeOf(node[spacename], new iname());
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
			throw new Error('Conflict member "' + spacename + '"');
		}
		node = node[spacename];
	}
	return node;
}


///----------------------------------------------------------------------
/// public
///----------------------------------------------------------------------
///名前空間funtion（iname継承）の機能
///prototypeへの追加
Object.defineProperty(iname.prototype, "extend", {
	value: function(){ return callExinherit.call(this, arguments, false, false); },
	enumerable: false, configurable: false
});
///prototypeへのdefineProperty
Object.defineProperty(iname.prototype, "exdef", {
	value: function(){ return callExinherit.call(this, arguments, true, false); },
	enumerable: false, configurable: false
});
///オブジェクトメンバへの追加
Object.defineProperty(iname.prototype, "append", {
	value: function(){ return callExinherit.call(this, arguments, false, true); },
	enumerable: false, configurable: false
});
///オブジェクトメンバへのdefineProperty
Object.defineProperty(iname.prototype, "apdef", {
	value: function(){ return callExinherit.call(this, arguments, true, true); },
	enumerable: false, configurable: false
});

///globalへinameを公開
Object.defineProperty(window, "iname", {
	value: named.call(iname, "iname"),
	enumerable: false, configurable: false
});

})();
