'use strict';

const splitSkip = require('split-skip');
const unpackString = require('unpack-string');
const stringifyParameters = require('stringify-parameters');

const isArrayLike = p => p.match(/^\[+/) || null;
const isObjectLike = p => p.match(/^{+/) || null;
const matchObjectProperty = p => p.match(/^([^{]+):(.*)/) || null;

function splitSkipBrackets(string, delimiter) {
	return splitSkip(string, delimiter, (state, char, i) => {

		if ('{[('.indexOf(char) >= 0) {
			state.skip += 1;
		}

		if ('}])'.indexOf(char) >= 0) {
			state.skip -= 1;
		}

		return state;
	});
}

function getParameterSpec(param) {
	if (!param) {
		return;
	}

	const [parameter, defaultValue] = splitSkipBrackets(param, '=').map(item => item.trim().replace(/^["']|["']$/g, ''));
	const parameterSpec = { parameter };

	if (defaultValue) {
		parameterSpec.defaultValue = defaultValue;
	}

	const expectsDestructuring = !!isArrayLike(param) || !!isObjectLike(param);
	if (expectsDestructuring) {
		parameterSpec.expectsDestructuring = true;
	}

	parameterSpec.declaration = param;
	return parameterSpec;
}

function getParametersArray(paramsString) {
	if (!paramsString) {
		return [];
	}

	paramsString = paramsString.trim();
	const result = splitSkipBrackets(paramsString, ',');
	return result.map(item => item.trim()).filter(item => !!item);
}

function destructureParametersFromArray(param, parameters = []) {
	let parametersArray = getParametersArray(unpackString(param));

	parametersArray.forEach(param => {
		if (isArrayLike(param)) {
			return destructureParametersFromArray(param, parameters);
		}

		// const { parameter, defaultValue, declaration } = getParameterSpec(param);
		// parameters.push({ parameter, defaultValue, declaration });

		parameters.push(getParameterSpec(param));
	});

	return parameters;
}

function destructureParametersFromObject(param, parameters = []) {
	let parametersArray = getParametersArray(unpackString(param));

	parametersArray.forEach(param => {
		let objectProperty = matchObjectProperty(param);
		if (objectProperty) {
			let [, key, value] = objectProperty.map(v => v.trim());
			if (isObjectLike(value)) {
				return destructureParametersFromObject(value, parameters);
			}
		}

		// const { parameter, defaultValue, declaration } = getParameterSpec(param);
		// parameters.push({ parameter, defaultValue, declaration });

		parameters.push(getParameterSpec(param));
	});

	return parameters;
}

function destructureParameters(param) {
	const parametersArray = getParametersArray(param);

	return parametersArray.reduce((parameters, parameter) => {
		if (isArrayLike(parameter)) {
			return parameters.concat(destructureParametersFromArray(parameter));
		}

		if (isObjectLike(parameter)) {
			return parameters.concat(destructureParametersFromObject(parameter));
		}

		return parameters.concat(getParameterSpec(parameter));
	}, []);
}

function inspectParameterFromString(parameter) {
	const parameterSpec = getParameterSpec(parameter);
	if (!parameterSpec || (!parameterSpec.parameter && !parameterSpec.declaration)) {
		return;
	}

	if (parameterSpec.expectsDestructuring) {
		parameterSpec.destructuredParameters = destructureParameters(parameter);
	}

	return parameterSpec;
}

function inspectParametersFromString(parameters) {
	const parametersArray = getParametersArray(parameters);

	if(!parametersArray || parametersArray.length === 1){
		return inspectParameterFromString(parameters);
	}

	const inspectedParameters = parametersArray.reduce((result, parameter) => {
		const parameterSpec = inspectParameterFromString(parameter);
		return result.concat(parameterSpec);
	}, []);

	return inspectedParameters;
}

function inspectParametersFromFunction(fn) {
	const parametersStringified = stringifyParameters(fn);
	return inspectParametersFromString(parametersStringified);
}

function getAllInspectedParametersNames(inspectedParameters) {
	if(!inspectedParameters){
		return [];
	}

	inspectedParameters = inspectedParameters.constructor === Array ? inspectedParameters : [inspectedParameters];
	return inspectedParameters.reduce((result, item) => {
		if (item.expectsDestructuring) {
			return result.concat(item.destructuredParameters.map(item => item.parameter));
		}

		return result.concat(item.parameter);
	}, []);
}

function getAllParametersNames(source) {
	const inspectedParameters = inspectParameters(source);
	return getAllInspectedParametersNames(inspectedParameters);
}

function inspectParameters(source) {
	if (!source) {
		return;
	}

	if(source.constructor === Function) {
		return inspectParametersFromFunction(source);
	}

	if(source.constructor === String) {
		return inspectParametersFromString(source);
	}
}

module.exports = { inspectParameters, getAllParametersNames };