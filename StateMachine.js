
class StateMachine {
	
	constructor() {
		this.id = IdGen.getNewId();
		this.states = [];
		this.initialState = null;
		this.previousState = null;
		this.currentState = null;
		this.running = false;
	};

	// set
	setInitialState(state) {
		this.initialState = state;
	};

	addState(state) {
		let localStates = [];

		// add state
		this.states.push(state); /// secure filter
	};

	setTransitionConnections() {
		// pour chaque état
		for(const state in this.states) {
			const stateTransitions = this.states[state].getTransitions();

			// pour chaque transition de chaque état
			for(let transition in stateTransitions) {
				// connect des signaux
				stateTransitions[transition].getSignal().connect(this.onTransitionEmited, this);
			}
		}
	};

	// touts les signaux "transitionSignal" de C_State sont connectées ici
	onTransitionEmited(sender, data) {
		let family = [this.currentState];
		family = family.concat(this.currentState.getFamily());
		
		// pour chaque parents de l'état courant, on récupère les transitions
		for(const parent in family) {
			const transitions = family[parent].getTransitions();
		
			// pour chaque transition
			for(const transition in transitions) {

				// si l'emetteur est égal à l'emetteur du signal enregistré
				if(sender == transitions[transition].getSender()) {
					let nextState = transitions[transition].getNextState();
					if(nextState instanceof State) this.changeState(nextState);
					else if (nextState instanceof HistoryState) this.changeState(nextState.getMemorisedState());
					break;
				}
			}
		}
	};

	// get
	getStates() {
		return this.states;
	};

	// actions
	start() {
		this.changeState(this.initialState);
		this.setTransitionConnections();
		this.running = true;
	};

	stop() {
		this.changeState(this.initialState);
		this.running = false;
	};

	changeState(nextState) {
		let exitStates = null;
		let enterStates = null;

		if(this.currentState == null) {  // onStart
			let children = [nextState];
			children = children.concat(nextState.getChildren());

			for(const element in children) {
				children[element].entered();
				this.currentState = children[element];
				//console.log("Enter state:")
				//console.log(this.currentState.getId());
			}
		}

		else {  // this.currentState -> nextState
			exitStates = [this.currentState];
			exitStates = exitStates.concat(this.currentState.getFamilyUntilCommonParent(nextState));

			//enterStates = [nextState];
			enterStates = nextState.getChildren().reverse();
			enterStates = enterStates.concat([nextState]);
			enterStates = enterStates.concat(nextState.getFamilyUntilCommonParent(this.currentState));
			enterStates = enterStates.reverse();

			//console.log(enterStates);

			///Action!
			//exit
			for(const state in exitStates) {
				exitStates[state].exited();
				this.currentState = exitStates[state];
				//console.log("Exit states:");
				//console.log(exitStates[state].getId());
			}

			//enter
			for(const state in enterStates) {
				enterStates[state].entered();
				this.currentState = enterStates[state];
				//console.log("Enter state:");
				//console.log(enterStates[state].getId());
			}
		}
	};
}





class State {
	constructor(parent = null) {

		this.id = IdGen.getNewId();
		this.transitions = [];
		this.stateMachine = [];
		
		// signals
		this.sEntered = Signal.create("sEntered");
		this.sExited = Signal.create("sExited");

		// hierarchy
		this.parent = parent;
		this.initialState = null;

		// history
		this.historyState = null;

		// name
		this.name = null;
	};

	// set
	addTransition(sender, signal, nextState) {
		this.transitions.push(new Transition(sender, signal, nextState));
	};

	setName(name) {
		this.name = name;
	};

	// getters
	getId() {
		return this.id;
	};

	getName() {
		return this.name;
	};

	getTransitions() {
		return this.transitions;
	};

	getTransitionSignal() {
		return this.transitionSignal;
	};

	entered() {
		this.updateHistory();
		this.sEntered.emit(this, null);
	};

	exited() {
		this.sExited.emit(this, null); 
	};



	// hierarchical
	getInitialState(state) {
		return this.initialState;
	};

	setInitialState(state) {
		this.initialState = state;
	};

	getParent() {
		return this.parent;
	};

	getFamily() {  // ne récupère pas l'étate this
		let family = [];
		let currentParent = this.getParent();

		while(currentParent != null) {
			family.push(currentParent);
			currentParent = currentParent.getParent();
		}

		return family;
	};

	getFamilyUntilCommonParent(state) {
		let thisFamily = this.getFamily();
		let stateFamily = state.getFamily();

		const filteredArray = thisFamily.filter(value => stateFamily.includes(value));

		let firstCommonParent = null;
		if(filteredArray.length > 0) {
			firstCommonParent = filteredArray[0];
		}

		let thisUncommonFamily = [];

		for(const parent in thisFamily) {
			if(thisFamily[parent] == firstCommonParent) {
				break;
			}
			thisUncommonFamily.push(thisFamily[parent]);
		}

		return thisUncommonFamily;
	};

	getChildren() {
		let familyToInitialStates = [];

		let currentInitialState = this.getInitialState();
		while(currentInitialState != null)
		{
			familyToInitialStates.push(currentInitialState);
			currentInitialState = currentInitialState.getInitialState();
		}	

		return familyToInitialStates;
	};
	//history
	setHistory(historyState) {
		this.historyState = historyState;
	};

	getHistory() {
		return this.historyState;
	};

	updateHistory() {
		let family = [this];
		family = family.concat(this.getFamily());
		
		for(const parent in family) {
			if(family[parent] != null) {
				if(family[parent].getHistory() != null) family[parent].getHistory().updateCurrentState(this);
			}
		}
	};
}



class HistoryState {

	constructor(state) {
		this.id = IdGen.getNewId();
		this.state = state;  // history of this state
		this.currentState = state.getInitialState();
		this.state.setHistory(this);
	};

	updateCurrentState(state) {
		this.currentState = state;
	};

	getMemorisedState() {
		return this.currentState;
	};

}



class Transition {
	constructor(sender=null, signal=null, nextState=null) {
		this.sender = sender;
		this.signal = signal;
		this.nextState = nextState;
	};

	setTransition(sender, signal, nextState) {
		this.sender = sender;
		this.signal = signal;
		this.nextState = nextState;
	};

	getSender() {
		return this.sender;
	};

	getSignal() {
		return this.signal;
	};

	getNextState() {
		return this.nextState;
	};
}

class IdGen {
	static lastId = 0;

	static getNewId() {
		this.lastId++;
		return this.lastId;
	};

	static getLastId() {
		return this.lastId;
	};

	static setLastId(id) {
		this.lastId = id;
	};
}



(function(global) {
    var prevSignal = global.Signal;

    var Signal = {
        __version__: '0.1.3',
        __license__: 'MIT',
        __author__: 'Ye Liu',
        __contact__: 'yeliu@instast.com',
        __copyright__: 'Copyright (c) 2015 Ye Liu'
    };

    Signal.noConflict = function() {
        global.Signal = prevSignal;
        return this;
    };

    /* ----- User Configurable Properties ----- */

    Signal.allowDuplicateSlots = false;

    Signal.isSenderCompatible = function(expected, actual) {
        if (expected !== undefined && expected !== null) {
            return expected === actual;
        }
        return true;
    };

    /* ----- General Helper Functions ----- */

    var emptyFn = function() {}

    var toString = Object.prototype.toString;

    var isObject;

    if (toString.call(null) === '[object Object]') {
        isObject = function (o) {
            return (o !== null && o !== undefined &&
                toString.call(o) === '[object Object]');
        };
    } else {
        isObject = function(o) {
            return toString.call(o) === '[object Object]';
        };
    }

    var isFunction;

    if (document !== undefined &&
            typeof document.getElementsByTagName('body') === 'function') {
        isFunction = function(o) {
            return toString.call(o) === '[object Function]';
        };
    } else {
        isFunction = function(o) {
            return typeof o === 'function';
        };
    }

    var argumentsToArray = function(a) {
        var args = [];

        a = a || [];

        for (var i = 0; i < a.length; i++) {
            args[i] = a[i];
        }

        return args;
    };


    /* ----- Helper Functions ----- */

    var objIdSeq = 1;

    var markObj = Signal.markObj = function(o) {
        if (isObject(o) && !o._signalObjId) {
            o._signalObjId = objIdSeq++;
        }

        return o;
    };

    var unmarkObj = Signal.unmarkObj = function(o) {
        if (isObject(o)) {
            delete o._signalObjId;
        }

        return o;
    };

    var compareObj = function(x, y) {
        if (isObject(x) && isObject(y)) {
            if (x._signalObjId && y._signalObjId) {
                return x._signalObjId === y._signalObjId;
            }
        }

        return x === y;
    };


    /* ----- Slot ----- */

    var slotIdSeq = 0;

    var Slot = Signal.Slot = function(fn, receiver, sender) {
        this.id = slotIdSeq++;
        this._fn = fn || emptyFn;
        this._receiver = receiver || null;
        this._sender = sender || null;
    };

    Slot.prototype.call = function() {
        return this._fn.apply(this._receiver, arguments);
    };

    Slot.prototype.isEqual = function(o) {
        return this.compare(o, compareObj, compareObj);
    };

    Slot.prototype.isCompatible = function(o) {
        return this.compare(o, compareObj, Signal.isSenderCompatible);
    };

    Slot.prototype.isSenderCompatible = function(sender) {
        var isSenderCompatible = Signal.isSenderCompatible;

        if (isFunction(isSenderCompatible)) {
            return isSenderCompatible(this._sender, sender);
        }

        return this._sender === sender;
    };

    Slot.prototype.compare = function(o, compareReceiver, compareSender) {
        if (!(o instanceof Slot)) {
            return false;
        }

        if (this === o || this.id === o.id) {
            return true;
        }

        if (this._fn !== o._fn) {
            return false;
        }

        if (isFunction(compareReceiver) &&
                !compareReceiver(this._receiver, o._receiver)) {
            return false;
        }

        if (isFunction(compareSender) &&
                !compareSender(this._sender, o._sender)) {
            return false;
        }

        return true;
    };


    /* ----- BaseSignal ----- */

    var BaseSignal = Signal.BaseSignal = function() {
        this.slots = [];
    };

    BaseSignal.prototype.connect = function(slotFn, receiver, sender) {
        var newSlot;

        markObj(receiver);
        markObj(sender);

        newSlot = new Slot(slotFn, receiver, sender);

        if (!Signal.allowDuplicateSlots) {
            for (var i = this.slots.length - 1; i >= 0; i--) {
                if (this.slots[i].isEqual(newSlot)) {
                    return this.slots[i];
                }
            }
        }

        this.slots.push(newSlot);

        return newSlot;
    };

    BaseSignal.prototype.emit = function(sender) {
        var slot;

        for (var i = 0; i < this.slots.length; i++) {
            slot = this.slots[i];
            if (slot.isSenderCompatible(sender)) {
                slot.call.apply(slot, arguments);
            }
        }
    };

    BaseSignal.prototype.asyncEmit = function(sender) {
        var self = this;
        var args = arguments;

        setTimeout(function() {
            self.emit.apply(self, args);
        }, 1);
    };

    BaseSignal.prototype.disconnect = function(slotFn, receiver, sender) {
        return this.disconnectBySlot(new Slot(slotFn, receiver, sender));
    };

    BaseSignal.prototype.disconnectBySlot = function(slot) {
        var i = 0;
        var ret = null;

        while (i < this.slots.length) {
            if (this.slots[i].isEqual(slot)) {
                ret = this.slots.splice(i, 1);
            } else {
                i++;
            }
        }

        return ret ? ret[0] : null;
    };


    /* ----- Convenient Functions ----- */

    var signals = {};

    var create = Signal.create = function(name) {
        var signal = null;

        if (name === undefined || name === null) {
            return signal;
        }

        if (name in signals) {
            signal = signals[name];
        } else {
            signal = signals[name] = new BaseSignal();
        }

        return signal;
    };

    var connect = Signal.connect = function(name, slotFn, receiver, sender) {
        var signal = create(name);

        if (signal) {
            return signal.connect(slotFn, receiver, sender);
        }

        return null;
    };

    var disconnect = Signal.disconnect = function(name,
            slotFn, receiver, sender) {
        var signal = create(name);

        if (signal) {
            return signal.disconnect(slotFn, receiver, sender);
        }

        return null;
    };

    var disconnectBySlot = Signal.disconnectBySlot = function(name, slot) {
        var signal = create(name);

        if (signal) {
            return signal.disconnectBySlot(slot);
        }

        return null;
    };

    var emit = Signal.emit = function(name) {
        var signal = create(name);
        var args;

        if (!signal) {
            return;
        }

        args = argumentsToArray(arguments);
        args.shift();

        signal.emit.apply(signal, args);
    };

    var asyncEmit = Signal.asyncEmit = function(name) {
        var signal = create(name);
        var args;

        if (!signal) {
            return;
        }

        args = argumentsToArray(arguments);
        args.shift();

        signal.asyncEmit.apply(signal, args);
    };

    /* ----- Exports ----- */

    if (typeof module !== 'undefined') {
        module.exports = Signal;
    } else if (typeof define !== 'undefined') {
        define(Signal);
    } else {
        global.Signal = Signal;
    }
})(this);