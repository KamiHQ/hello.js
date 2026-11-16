
var utils = hello.utils;

function mockLocation(url) {
	var a = document.createElement('a');
	a.href = url;

	var mock = {
		assign: function() {

		}
	};

	var props = ['hash', 'host', 'hostname', 'href', 'origin', 'pathname', 'port', 'protocol', 'search'];
	for (var i = 0; i < props.length; i++) {
		var x = props[i];
		mock[x] = a[x];
	}

	return mock;
}

describe('utils.responseHandler', function() {

	// Window denotes the current window which is operating the script.
	// Parent refers to that windows parent.

	var _window;
	var _parent;
	var _state;
	var _accessToken;

	describe('OAuth handler', function() {

		var _store = utils.store;
		var _clock;

		beforeEach(function() {

			_clock = sinon.useFakeTimers();

			_accessToken = '1234';

			_state = {
				callback: '_hellojs_callbackTestFunc',
				network: 'network'
			};

			// Mock up _window and _parent objects for the tests
			_window = {
				location: mockLocation('http://adodson.com/redirect.html?state=' + JSON.stringify(_state) + '&access_token=' + _accessToken),
				close: function() {
				}
			};

			_parent = {
				postMessage: function() {
					// The parent receives the response as a message
				}
			};
		});

		afterEach(function() {
			_clock.restore();
			utils.store = _store;
		});

		it('should do nothing if the current window has no state parameter', function() {

			_window.location = mockLocation('http://adodson.com/redirect.html');

			var spy = sinon.spy();

			_window.close = spy;

			utils.responseHandler(_window, _parent);

			expect(spy.callCount).to.be(0);

		});

		it('should redirect to oauth proxy and preserve the query string', function() {
			_state.oauth_proxy = 'http://adodson.com/oauth_proxy?foo=bar';
			_state.redirect_uri = 'http://adodson.com/';

			_window.location = mockLocation('http://adodson.com/redirect.html?code=abc&state=' + JSON.stringify(_state));

			var spy = sinon.spy();
			_window.location.assign = spy;

			utils.responseHandler(_window, _parent);

			// Using regex, instead of eq comparison, because the order
			// of query string parameters is not guaranteed
			expect(spy.args[0][0]).to.match(/foo=bar/);
			expect(spy.args[0][0]).to.match(/redirect_uri=/);
		});

		// Kami: the response handler leaves navigation back to page_uri to the calling application
		[undefined, 'https://', 'https://example.com', /^https:\/\/(www.)?example.com/].forEach(HELLOJS_REDIRECT_URL => {

			var PAGE_URI = 'https://example.com/path';

			it(`should not redirect to page_uri ${PAGE_URI} if 'HELLOJS_REDIRECT_URL=${HELLOJS_REDIRECT_URL}'`, function() {

				_state.page_uri = PAGE_URI;

				_window.location = mockLocation('http://adodson.com/redirect.html?state=' + JSON.stringify(_state));

				var spy = sinon.spy();
				_window.location.assign = spy;

				if (HELLOJS_REDIRECT_URL !== undefined) {
					_window.HELLOJS_REDIRECT_URL = HELLOJS_REDIRECT_URL;
				}

				utils.responseHandler(_window, _parent);

				expect(spy.callCount).to.be(0);
			});
		});

		[false, 'http://', 'https://anotherdomain.com'].forEach(HELLOJS_REDIRECT_URL => {

			var PAGE_URI = 'https://example.com/path';

			it(`should not redirect to page_uri ${PAGE_URI} if 'HELLOJS_REDIRECT_URL=${HELLOJS_REDIRECT_URL}'`, function() {
				_state.page_uri = PAGE_URI;

				_window.location = mockLocation('http://adodson.com/redirect.html?state=' + JSON.stringify(_state));

				var spy = sinon.spy();
				_window.location.assign = spy;

				_window.HELLOJS_REDIRECT_URL = HELLOJS_REDIRECT_URL;

				utils.responseHandler(_window, _parent);

				// Should not redirect to anywhere
				expect(spy.notCalled);
			});
		});


		it('should post the access_token to the parent if the current window location contains a access_token and a state parameter containing a callback and network', function() {

			var spy = sinon.spy();
			_window.close = spy;

			var spy2 = sinon.spy();
			_parent.postMessage = spy2;

			utils.responseHandler(_window, _parent);

			expect(spy2.calledOnce).to.be.ok();

			var message = spy2.args[0][0];

			expect(message).to.have.property('hellojs_callback', _state.callback);
			expect(message.message).to.be.a('string');

			var response = JSON.parse(message.message);

			expect(response).to.have.property('network', _state.network);
			expect(response).to.have.property('access_token', _accessToken);
			expect(response).to.not.have.property('callback');

			// The window is closed shortly after, in case the message arrives late
			expect(spy.callCount).to.be(0);
			_clock.tick(300);
			expect(spy.calledOnce).to.be.ok();
		});

		it('should only post to the origin of the current window', function() {

			var spy = sinon.spy();
			_parent.postMessage = spy;

			utils.responseHandler(_window, _parent);

			expect(spy.args[0][1]).to.eql(_window.location.origin);
		});

		it('should always close window despite a parent which throws an exception', function() {

			var spy = sinon.spy();
			_window.close = spy;

			var spy2 = sinon.spy(function() {
				throw 'Error';
			});

			_parent.postMessage = spy2;

			utils.responseHandler(_window, _parent);

			expect(spy2.calledOnce).to.be.ok();

			_clock.tick(300);
			expect(spy.calledOnce).to.be.ok();
		});

		it('should close the iframe window', function(done) {

			// Fake timers would stop the iframe from closing itself
			_clock.restore();

			var frm;
			var onMessage = function(e) {
				if (!e.data || e.data.hellojs_callback !== '_hellojs_testIframeCloses') {
					return;
				}

				window.removeEventListener('message', onMessage);

				// After the initial load we can expect this to have removed itself
				setTimeout(function() {
					expect(frm.parentNode).to.eql(null);
					done();
				}, 500);
			};

			window.addEventListener('message', onMessage);

			// In this example we load a page containing the responseHandler script on it.
			frm = document.createElement('iframe');
			frm.src = 'redirect.html?state={}&network=test&callback=_hellojs_testIframeCloses&access_token=token';
			document.body.appendChild(frm);

		});

		it('should post OAuth failures to the parent', function() {

			var spy = sinon.spy();
			_window.close = spy;
			_window.location = mockLocation('http://adodson.com/redirect.html?error=error&error_description=description&state=' + JSON.stringify(_state));

			var spy2 = sinon.spy();
			_parent.postMessage = spy2;

			utils.responseHandler(_window, _parent);

			expect(spy2.calledOnce).to.be.ok();

			var message = spy2.args[0][0];

			expect(message).to.have.property('hellojs_callback', _state.callback);

			var response = JSON.parse(message.message);

			expect(response).to.have.property('error');
			expect(response.error).to.have.property('code', 'error')
				.and.to.have.property('message', 'description');

			_clock.tick(300);
			expect(spy.calledOnce).to.be.ok();
		});

		it('should call hello.utils.store with the authResponse, including the callback property', function() {

			// The auth response is mutated after it is stored, so snapshot each call
			var stored = [];
			utils.store = function(name, value) {
				stored.push({name: name, value: JSON.parse(JSON.stringify(value))});
			};

			utils.responseHandler(_window, _parent);

			expect(stored.length).to.be.greaterThan(0);
			expect(stored[0].name).to.eql(_state.network);
			expect(stored[0].value).to.have.property('callback', _state.callback);
		});

		it('should store the granted scope under a separate property from the requested scope', function() {

			_state.scope = 'requested';
			_window.location = mockLocation('http://adodson.com/redirect.html?state=' + JSON.stringify(_state) + '&access_token=' + _accessToken + '&scope=granted');

			var stored = [];
			utils.store = function(name, value) {
				stored.push(JSON.parse(JSON.stringify(value)));
			};

			utils.responseHandler(_window, _parent);

			expect(stored[0]).to.have.property('scope', 'requested');
			expect(stored[0]).to.have.property('granted_scope', 'granted');
		});

		it('should not post to the parent when the page is displayed as a page', function() {

			_state.display = 'page';
			_window.location = mockLocation('http://adodson.com/redirect.html?state=' + JSON.stringify(_state) + '&access_token=' + _accessToken);

			var spy = sinon.spy();
			_parent.postMessage = spy;

			utils.responseHandler(_window, _parent);

			expect(spy.callCount).to.be(0);
		});

	});

	xdescribe('POST Response', function() {

	});

});
