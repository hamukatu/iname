/**
 * @license Copyright 2016 garden-soft.com, studio-wiz.com, spica.tokyo
 * inheritance namespace version 1.3
 * author: m-kudo
 */

(function(){
"use strict";


///----------------------------------------------------------------------
/// private
///----------------------------------------------------------------------
/**
 * @description 型判定関数
 * @param {*} target 判定対象
 * @param {String} pattern 型（|区切りで複数指定可）
 * @returns {Boolean}
 * @example 
 *	TypeMatch("a", "string") -> true
 *	TypeMatch({}, "function") -> false
 *	TypeMatch([], "array|number") -> true
 *	TypeMatch(1, typeof 1 + "|" + typeof "") -> true
 */
//window.TypeMatch = function(target, pattern){
var TypeMatch = function(target, pattern){
	if(pattern instanceof RegExp){ return Object.prototype.toString.call(target).match(pattern) ? true : false; }
	return Object.prototype.toString.call(target).match(new RegExp('\\[object ('+pattern+')\\]', 'i')) ? true : false;
};

/**
 * @description thisへ、引数のオブジェクトを属性を含めて結合する。
 *  exinherit.apply(this, arguments)等でthisを規定して使う。
 *  {_define_:{}} が結合オブジェクトの場合definePropertyで定義される。
 * @returns {undefined}
 */
var exinherit = function(){
	//var src = this instanceof Function ? this.prototype : this,
	var src = this, ///functionだったらprototypeを……と思ったけどそれは呼び出し元でオナシャス
		dst = arguments[0],
		len = arguments.length;
	for(var i = 0; i < len && dst != null; dst = arguments[++i]){
		for(var key in dst){
			if(src[key] === dst[key]){ continue; }

			///※裏要素的な実装。dstに _define_:{} というメンバがあったら、
			///  definePropertyでsrcに定義する。_define_以外のメンバは無視する。
			if(dst[key] instanceof Object && dst[key].hasOwnProperty("_define_")){
				Object.defineProperty(src, key, dst[key]["_define_"]);
			}
			else if(src[key] instanceof Object && TypeMatch(dst[key], "object|array")){
				src[key] = exinherit.call(src[key], dst[key]);
			}
			else if(src[key] === undefined){
				Object.defineProperty(src, key, Object.getOwnPropertyDescriptor(dst, key));
				//src[key] = dst[key];
			}
		}
	}
	return this;
};

/**
 * @description おまけの拡張機能
 * 同じ系統のコンストラクタを持つオブジェクトのメンバ参照をインスタンスに設定する
 * 第一引数がundefinedでなく同じ系統のコンストラクタでもない場合はなにもしない。
 * 
 * インスタンス作成時に同系統の名前空間のインスタンスが第一引数だった場合に、
 * そのオブジェクトのメンバを参照できるようコピーして、第一引数を削除する
 * 第一引数がundefinedの場合は、メンバの参照はもちろんできないがその第一引数の削除のみ行う
 * @param {type} _super_ 参照するインスタンス
 * @returns {Array} arguments 条件次第で第一引数が削除されている
 * @example
 *	function root(){}
 *	root.prototype.member = "member1";
 *	root.ns("child", {
 *		child: function(_root){
 *			this._reference_super_(_root);
 *		}
 *	});
 *	var r = new root();
 *	r.member = "member2";
 *	var c = new root.child(r);
 *	console.log(c.member);
 *	とすると c に継承された member は r のプロパティを参照するのでコンソールに member2 が出力される。
 */
var _reference_instance_ = function(_super_){
//	var _super_ = base;
//	if(typeof _super_ !== "object" || !(this instanceof _super_.constructor)){ return this; }
	
	//thisが継承先としてcallされている
	//undefinedなら継承しない。しかし第一引数の削除は行う
	if(typeof _super_ === typeof undefined) { return Array.apply(null,arguments).slice(1); }
	//undefinedいがいの
	else if(typeof _super_ !== "object" || !(this instanceof _super_.constructor)){ return arguments; }

	//継承して第一引数を削除
	exinherit.call(this, _super_);
	return Array.apply(null,arguments).slice(1);

/*
	//※継承元と継承したいオブジェクトのコンストラクタが一致するまで全部走査する。
	//単純な線形のprototypeチェーンではなく樹形構造の枝同士だった場合、一致する親まで遡って探す。

	//継承元のオブジェクトを、Object になるまでprototypeチェーン走査
	while(_super_){
		//__proto__の参照置換を行うため、constructorが一致した一段階前の__proto__に代入したい
		var ref_proto = this; //これの __proto__ を参照置換する
		var ref_child_proto = Object.getPrototypeOf(ref_proto); //これのconstructorが一致したら目的の箇所	

		//継承したいオブジェクトのprototypeチェーンを走査
		while(ref_proto && ref_child_proto){
			///コンストラクタが一致する__proto__が見つかったらここで終了
			if(ref_child_proto.constructor === _super_.constructor){
//				Object.setPrototypeOf(ref_proto, base);
				Object.setPrototypeOf(ref_proto, _super_);
				///第一引数が省かれた配列として返す
				return Array.apply(null,arguments).slice(1);
			}
			ref_proto = ref_child_proto;
			ref_child_proto = Object.getPrototypeOf(ref_child_proto);
		}
		_super_ = Object.getPrototypeOf(_super_);
	}
	//全て走査してもconstructorが一致しなければrootの名前空間が違うということ。ここには来ないはず。
	console.warn("Tried to inherits different namespace.");
	return arguments;
*/
};

/**
 * @description 関数の名前変更。必ずcallで実行して this にあたるfunctionに名前を付けて返す。
 * @param {string} _name 変数名指定
 * @param {boolean} _origin 真の場合はただの名前変更。偽の場合、戻り値の関数には元の関数に「第一引数が同じ名前空間のコンストラクタを持つオブジェクトだったら、そのメンバの参照設定をする」いう機能を追加。
 *	という機能を追加。
 * @returns {Function}
 */
var named = function(_name, _origin){
	return (new Function("return function(c,r){return function " + _name + "(){return c(this," + (_origin ? "arguments" : "r.apply(this,arguments)") + ");};};")())(Function.apply.bind(this), _reference_instance_);
//	return (new Function("return function(c,r){return function " + _name + "(){return c(this,r.apply(this,arguments));};};")())(Function.apply.bind(this), _reference_instance_);
};


/**
 * @constructor
 * @description namespaceのルート（window直下）のプロトタイプ。
 * 名前空間オブジェクト全体に継承したい機能はこのfunctionのprototypeに定義していく。
 *  exinherit.call(ns_root, {追加したい機能や値などのオブジェクト}) としても良い。
 * @type function
 */
/*
var ns_root = named.call(function(){}, "ns");
///chain関数でも_super_を定義しているけどそれとは別物。これはインスタンスから親クラスを取得するためのメソッド。
Object.defineProperty(ns_root.prototype, "_super_", {
	get: function(){ return this.constructor["_super_"]; },
	set: function(_super_){},
	configurable: false
});
*/

//exinherit.call(ns_root, {
	//function(){
	//	return Object.getPrototypeOf(Object.getPrototypeOf(this)).constructor;
	//}
	//"_super_": null
	/**
	 * @description おまけの拡張機能
	 * 同じ系統のコンストラクタを持つオブジェクトのメンバ参照をインスタンスに設定する
	 * nsで名前空間として定義されたクラスに _reference_super_ メンバとして定義
	 * @param {type} _super_ 参照するインスタンス
	 * @returns {undefined}
	 * @example
	 *	function root(){}
	 *	root.prototype.member = "member1";
	 *	root.ns("child", {
	 *		child: function(_root){
	 *			this._reference_super_(_root);
	 *		}
	 *	});
	 *	var r = new root();
	 *	r.member = "member2";
	 *	var c = new root.child(r);
	 *	console.log(c.member);
	 *	とすると c に継承された member は r のプロパティを参照するのでコンソールに member2 が出力される。
	 */
/*
	"_reference_super_": function(_super_){
		//※継承元と継承したいオブジェクトのコンストラクタが一致するまで全部走査する。
		//単純な線形のprototypeチェーンではなく樹形構造の枝同士だった場合、一致する親まで遡って探す。

		//継承元のオブジェクトを、Object になるまでprototypeチェーン走査
		while(_super_){
			//__proto__の参照置換を行うため、constructorが一致した一段階前の__proto__に代入したい
			var ref_proto = this; //これの __proto__ を参照置換する
			var ref_child_proto = Object.getPrototypeOf(ref_proto); //これのconstructorが一致したら目的の箇所	
			//var ref_child_proto = ref_proto.__proto__; //これのconstructorが一致したら目的の箇所	

			//継承したいオブジェクトのprototypeチェーンを走査
			while(ref_proto && ref_child_proto){
				if(ref_child_proto.constructor === _super_.constructor){
					Object.setPrototypeOf(ref_proto, _super_);
					//ref_proto.__proto__ = _super_;
					return this;
				}
				ref_proto = ref_child_proto;
				ref_child_proto = Object.getPrototypeOf(ref_child_proto);
				//ref_child_proto = ref_child_proto.__proto__;
			}
			_super_ = Object.getPrototypeOf(_super_);
			//_super_ = _super_.__proto__;
		}

		//全て走査してもconstructorが一致しなければrootの名前空間が違うということ
		console.warn("Tryed to inherits different constructor.");
		return this;
	}
*/
//});


//var chain = function(space){
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

			/*
			if( parent instanceof Window ){
				//名前空間のルートなのでルート用プロトタイプを設定
				Object.setPrototypeOf(parent[spacename].prototype, ns_root_prototype);
			}
			//else if(typeof parent === "function"){
			else {
				//プロトタイプチェーン
				Object.setPrototypeOf(parent[spacename].prototype, parent.prototype);
				//※ __proto__を使わないように書くと↑こうなる。↓と同じ。
				//parent[spacename].prototype.__proto__ = parent.prototype;
			}
			*/
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

/*
var ns_base = function(_space, _constructor){
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
};
*/

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




















//--------------------------------------------------------------------------
//▼古いバージョン（削除予定）

/**
 * @description prototypeの継承およびprototype定義を行う
 * ・引数は可変。functionかObjectを指定。prototypeまたはプロパティがマージされる。
 * ・base(※this)を継承先functionとし、第２引数以降に継承元functionまたはオブジェクトを指定。
 * ・継承元のprototypeはoverload
 * ・_super_というObjectをpropertyに追加
 *   prototype._super_[継承元function名]で参照できる。（擬似的なbaseコンストラクタ呼び出し）
 * @param {(...[function]):void|Object)} ... 可変引数。function or Object
 * @returns {undefined}
 * @constructor
 */
var inherits = function(){
	//globalオブジェクトへの継承は不可
	if(this instanceof Window){
		console.warn('Tried to inherit to the window');
		return;
	}

	/**
	 * @description inherits処理での型判定専用
	 * @param {type} _o
	 * @returns {Number}
	 */
	var type_field = function(_o){
		if(!(_o instanceof Object)){ return 0x00; }
		else if(_o.constructor.name === "Object"){ return 0x01; }
		else if(_o instanceof Array){ return 0x02; }
		else if(_o instanceof Function){ return 0x04; }
	};

	for(var i = 0; i < arguments.length; i++){
		var arg = arguments[i];
		
		///継承元（引数）がfunctionの場合
		var arg_type = type_field(arg);
		if(arg_type === 0x04){
			///第一引数がfunctionの場合は継承（prototypeチェーン）
			if(i === 0){
				//this.prototype = new arg(); ///当然だが new するとargのコンストラクタがこの時点で実行されるのでNG
				this.prototype = Object.create(arg.prototype);
				this.prototype.constructor = this;
				continue;
			}
			else{
				arg = arg.prototype;
			}
		}
		///オブジェクト以外の場合
		//継承元のプロパティが結合対象なので、functionとobject以外はマージしない
		else if(arg_type !== 0x01){
			continue;
		}

		///継承元（引数）のメンバを走査し、継承先のprototypeへ結合
		for(var p in arg){
			
			///継承先と継承元の同名プロパティの型をフラグにまとめる
			var mergetype = type_field(arg[p]);
			if(typeof this.prototype[p] !== "undefined"){
				mergetype |= (type_field(this.prototype[p]) << 4);
			}
			
			///●argメンバをbaseへ結合する際の型組み合わせごとの処理分岐
			//           arg→
			//↓base         |0x01 object |0x02 Array  |0x04 Function |0x00 (other)|
			// --------------+------------+------------+--------------+------------|
			// 0x10  object  |merge       |merge       |override      |override    |
			//               |          {}|          {}|              |            |
			// --------------+------------+------------+--------------+------------|
			// 0x20  Array   |merge       |merge       |override      |override    |
			//               |          {}|          []|              |            |
			// --------------+------------+------------+--------------+------------|
			// 0x40  Function|(*)merge    |override    |override      |override    |
			//               |    function|            |              |            |
			// --------------+------------+------------+--------------+------------|
			// 0x00  (other) |override    |override    |override      |override    |
			//   or undefined|            |            |              |            |
			// --------------+------------+------------+--------------+------------|
			// (*)functionのメンバ（prototypeではなく）にobjectを結合
			if( mergetype === 0x22 ){
				//this.prototype[p] = exinherit.call([], this.prototype[p], arg[p]);
				//this.prototype[p] = obj_extends([], this.prototype[p], arg[p]);
				this.prototype[p] = $.extend(true, [], this.prototype[p], arg[p]);
			}
			else if( (mergetype & 0x30) && (mergetype & 0x03) ){
				//this.prototype[p] = exinherit.call({}, this.prototype[p], arg[p]);
				//this.prototype[p] = obj_extends({}, this.prototype[p], arg[p]);
				this.prototype[p] = $.extend(true, {}, this.prototype[p], arg[p]);
			}
			else if(mergetype === 0x41){
				//exinherit.call(this.prototype[p], arg[p]);
				//obj_extends(this.prototype[p], arg[p]);
				$.extend(true, this.prototype[p], arg[p]);
			}
			else{
				this.prototype[p] = arg[p];
			}
		}
	}
	return this;
};










/**
 * @description namespaceの追加。functionの子にfunctionが追加されたら自動的にinherits
 * @param {string} _name namespaceチェイン
 * @param {Object} _property namespace末端の詳細プロパティ（prototype追加）
 * @param {Object} _static_property namespace末端の詳細プロパティ（object追加）
 * @returns {Function}
 * @example
 *	例１
 *		//グローバルに宣言する名前空間
 *		function MySpace(){}
 *		//名前空間 MySpace.module と moduleクラスを作成。Message プロパティを追加。
 *		//.namespaceの第一引数（名前空間定義）ではグローバル名 "MySpace" は省略できる。
 *		MySpace.namespace("module", {
 *			Message: "sample"
 *		})
 *		//名前空間 MySpace.module.ClassA と ClassAクラスを作成。Func1プロパティを追加。
 *		//newですぐに実体を作る。名前空間と同名のClassAがコンストラクタとして呼び出され
 *		//引数 ["arg1"] が渡される。
 *		new (MySpace.namespace("MySpace.module.ClassA", {
 *			"ClassA": function(args){
 *				///上位階層の module で定義されている Messageには下位からアクセスできる。
 *				console.log(this.Message + args[0]);
 *			}
 *		}))(["arg1"]);
 *		
 *	例２
 *		//eval等、動的にグローバル変数化する場合に宣言を複数回呼び出してもよい方法
 *		if(typeof window["MySpace"] === "undefined"){
 *			window["MySpace"] = (function(){}).named("MySpace");
 *		}
 *		///第２引数に静的プロパティを指定する方法と _static_ について。
 *		MySpace.namespace("module.ClassB"
 *			///prototypeへ
 *			,{
 *				ClassB: function(){
 *					//_static_ というObjectは自動的に追加される
 *					MySpace.module.ClassB._static_["StaticValue"] = "fuga";
 *				}
 *			}
 *			///MySpace.module.ClassB 直下のメンバへ（global的に使う）
 *			,{
 *				GlobalValue: "hoge"
 *			}
 *		);
 * @constructor
 */
//Function.prototype.proto = function(_name, _property, _static_property){
Function.prototype.namespace = function(_name, _property, _static_property){
	_property = _property || {};
	_static_property = _static_property || {};

//	if(!this.name && typeof _name !== "string"){
//		throw new Error("Tried to make namespace by anonymous function.");
////		if(typeof _name === "string"){ return named.call(this, _name); }
//	}
	//▼ポリモーフィズムを擬似的に実現
	if(typeof _name === "object"){
		_static_property = _property;
		_property = _name || {};
		_name = null;
	}
	else if(typeof _name !== "string"){
		throw new Error("namespace called illegal args.");
	}
	
	if((_property && typeof _property !== "object") || (_static_property && typeof _static_property !== "object")){ throw new Error("namespace called illegal args."); }
	
//	if(!this.prototype.hasOwnProperty("_reference_super_")){
		//同じ系統のコンストラクタを持つオブジェクトのプロパティを、__protp__ で参照（つまりthis.からアクセス）できるようにする。
		//名前空間の最上位オブジェクトのメンバ
//		this.prototype["_reference_super_"] = reference_super;
//	}
	var parent = this;
		
	///名前空間が指定されていない場合（※globalに定義されたnamespaceのrootの場合）
	if( !_name ){
		if(!this.name){ throw new Error("Tried to make namespace by anonymous function."); }
		//functionは定義済みなのでコンストラクタを変更することはできない
		//global名と同じメンバは削除しないで残しておく
		//	delete this[this.name];
		//parent.inherits(_property); //_propertyを継承する
		inherits.call(parent, _property); //_propertyを継承する
		///静的メンバの付与
		for(var p in _static_property){ parent[p] = _static_property[p]; }
	}
	else{
		var space = _name.split(".");
		if(!this.name){ parent = named.call(parent, space[0], true); }
		//if(!this.name){ parent = parent.named(space[0]); }

		///namespaceの走査
		for(var i = 0; i < space.length; i++){
			var spacename = space[i]; ///スペースのノード名

			///spaceノードを作成する
			if(typeof parent[spacename] !== "function"){
				///ネームスペース作成の目的である末端階層の場合
				if(i === (space.length - 1)){
					//space名と同名でfunctionのpropertyがあればコンストラクタということにして、
					//それをfunctionの本体とする。
					if(typeof _property[spacename]==="function"){
						//parent[spacename] = _property[spacename].named(spacename);
						parent[spacename] = named.call(_property[spacename], spacename, true);
						delete _property[spacename];
					}
					else{
						//parent[spacename] = (function(){}).named(spacename);
						parent[spacename] = named.call(function(){}, spacename, true);
					}
					//parent[spacename].inherits(parent, _property); //_propertyを継承する
					inherits.call(parent[spacename], parent, _property); //_propertyを継承する
					//parent[spacename]["_static_"] = {}; //ノードにデフォルトでstatic領域を作成

					///静的メンバの付与
					for(var p in _static_property){ parent[spacename][p] = _static_property[p]; }
				}
				///namespaceの途中階層も全てfunctionにする
				else{
					//parent[spacename] = (function(){}).named(spacename);
					parent[spacename] = named.call(function(){}, spacename, true);
					//parent[spacename].inherits(parent); //_propertyを継承する
					inherits.call(parent[spacename], parent);
					//parent[spacename]["_static_"] = {}; //ノードにデフォルトでstatic領域を作成
				}

				parent[spacename]["_super_"] = parent; //親functionを参照できるようにしておく
			}

			///次の親
			parent = parent[spacename];
		}
	}
	return parent;
};




})();
