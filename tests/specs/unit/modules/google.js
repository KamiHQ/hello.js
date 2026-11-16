// Kami customisations to the google module

describe('google module', function() {

	var xhr = hello.services.google.xhr;

	function request(method, data) {
		return {
			method: method,
			data: data,
			query: {},
			headers: {},
			authResponse: {access_token: 'token'}
		};
	}

	it('should send the access_token as an Authorization header', function() {

		var p = request('get');

		expect(xhr(p)).to.be.ok();
		expect(p.headers).to.have.property('Authorization', 'Bearer token');
		expect(p.query).to.not.have.property('access_token');
	});

	it('should not send an Authorization header without a session', function() {

		var p = request('get');
		p.authResponse = null;

		xhr(p);

		expect(p.headers).to.not.have.property('Authorization');
	});

	it('should send PATCH data as a JSON body and merge it into the query', function() {

		var p = request('patch', {title: 'name'});

		xhr(p);

		expect(p.query).to.have.property('title', 'name');
		expect(p.data).to.eql('{"title":"name"}');
		expect(p.headers).to.have.property('content-type', 'application/json');
	});

	it('should map me/files with an id to a single file request', function(done) {

		hello.services.google.get['me/files']({query: {id: 'abc'}}, function(path) {
			expect(path).to.contain('drive/v2/files/@{id}');
			expect(path).to.contain('supportsTeamDrives=true');
			done();
		});
	});

	it('should map me/files without an id to a list request', function(done) {

		hello.services.google.get['me/files']({query: {}}, function(path) {
			expect(path).to.contain('trashed=false');
			expect(path).to.contain('supportsTeamDrives=true');
			done();
		});
	});
});
