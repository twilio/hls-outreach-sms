# --------------------------------------------------------------------------------------------------------------
# FOR DEVELOPER USE ONLY!!!
# --------------------------------------------------------------------------------------------------------------

# ---------- check twilio credentials from environment variables
# when below 2 variables are set, it will be the 'active' profile of twilio cli
ifndef TWILIO_ACCOUNT_SID
$(info Lookup your "ACCOUNT SID" at https://console.twilio.com/)
$(info execute in your terminal, 'export TWILIO_ACCOUNT_SID=AC********************************')
$(error TWILIO_ACCOUNT_SID environment variable is not set)
endif

ifndef TWILIO_AUTH_TOKEN
$(info Lookup your "AUTH TOKEN" at https://console.twilio.com/)
$(info execute in your terminal, 'export TWILIO_AUTH_TOKEN=********************************')
$(info TWILIO_AUTH_TOKEN environment variable is not set)
endif


# ---------- variables
APPLICATION_NAME := $(shell basename `pwd`)
SERVICE_UNAME    := $(APPLICATION_NAME)
VERIFY_FNAME     := $(APPLICATION_NAME)
VERSION          := $(shell jq --raw-output .version package.json)
INSTALLER_NAME   := hls-outreach-installer
INSTALLER_TAG_V  := twiliohls/$(INSTALLER_NAME):$(VERSION)
INSTALLER_TAG_L  := twiliohls/$(INSTALLER_NAME):latest
GIT_REPO_URL     := $(shell git config --get remote.origin.url)
CPU_HARDWARE     := $(shell uname -m)
DOCKER_EMULATION := $(shell [[ `uname -m` == "arm64" ]] && echo --platform linux/amd64)
$(info ================================================================================)
$(info APPLICATION_NAME   : $(APPLICATION_NAME))
$(info GIT_REPO_URL       : $(GIT_REPO_URL))
$(info INSTALLER_NAME     : $(INSTALLER_NAME))
$(info INSTALLER_TAG_V    : $(INSTALLER_TAG_V))
$(info CPU_HARDWARE       : $(shell uname -m))
$(info DOCKER_EMULATION   : $(DOCKER_EMULATION))
$(info TWILIO_ACCOUNT_NAME: $(shell twilio api:core:accounts:fetch --sid=$(TWILIO_ACCOUNT_SID) --no-header --properties=friendlyName))
$(info TWILIO_ACCOUNT_SID : $(TWILIO_ACCOUNT_SID))
$(info TWILIO_AUTH_TOKEN  : $(shell echo $(TWILIO_AUTH_TOKEN) | sed 's/./*/g'))
$(info SERVICE_UNAME      : $(SERVICE_UNAME))
$(info VERIFY_FNAME       : $(VERIFY_FNAME))
$(info ================================================================================)


targets:
	@echo ----- available make targets:
	@grep '^[A-Za-z0-9\-]*:' Makefile | cut -d ':' -f 1 | sort


installer-build-github:
	$(eval BRANCH := $(shell if [[ -z "$(BRANCH)" ]]; then echo 'main'; else echo $(BRANCH); fi))
	docker build --tag $(INSTALLER_TAG_V) --tag $(INSTALLER_TAG_L) $(DOCKER_EMULATION) --no-cache $(GIT_REPO_URL)#$(BRANCH)


installer-build-local:
	docker build --tag $(INSTALLER_TAG_V) --tag $(INSTALLER_TAG_L) $(DOCKER_EMULATION) --no-cache .


installer-run:
	docker run --name $(INSTALLER_NAME) --rm --publish 3000:3000 $(DOCKER_EMULATION) \
	--env ACCOUNT_SID=$(TWILIO_ACCOUNT_SID) --env AUTH_TOKEN=$(TWILIO_AUTH_TOKEN) \
	--interactive --tty $(INSTALLER_TAG_V)


installer-open:
	@while [[ -z $(curl --silent --head http://localhost:3000/installer/index.html) ]]; do \
      sleep 2 \
      echo "installer not up yet..." \
    done
	open -a "Google Chrome" http://localhost:3000/installer/index.html


get-service-sid:
	$(eval SERVICE_SID := $(shell twilio api:serverless:v1:services:list -o=json \
	| jq --raw-output '.[] | select(.uniqueName == "$(SERVICE_UNAME)") | .sid'))
	@if [[ ! -z "$(SERVICE_SID)" ]]; then \
      echo "SERVICE_SID=$(SERVICE_SID)"; \
    else \
	  echo "$@: Service named $(SERVICE_UNAME) is not deployed!!! aborting..."; \
	fi
	@[[ ! -z "$(SERVICE_SID)" ]]


get-environment-sid: get-service-sid
	$(eval ENVIRONMENT_SID := $(shell twilio api:serverless:v1:services:environments:list --service-sid $(SERVICE_SID) -o=json \
	| jq --raw-output '.[0].sid'))
	$(eval ENVIRONMENT_NAME := $(shell twilio api:serverless:v1:services:environments:list --service-sid $(SERVICE_SID) -o=json \
	| jq --raw-output '.[0].uniqueName'))
	$(eval ENVIRONMENT_DOMAIN := $(shell twilio api:serverless:v1:services:environments:list --service-sid $(SERVICE_SID) -o=json \
	| jq --raw-output '.[0].domainName'))
	@if [[ ! -z "$(ENVIRONMENT_SID)" ]]; then \
	  echo "ENVIRONMENT_SID=$(ENVIRONMENT_SID)"; \
	  echo "ENVIRONMENT_NAME=$(ENVIRONMENT_NAME)"; \
	  echo "ENVIRONMENT_DOMAIN=$(ENVIRONMENT_DOMAIN)"; \
	else \
	  echo "$@: Environment for service named $(SERVICE_UNAME) is not found!!! aborting..."; \
	fi
	@[[ ! -z "$(ENVIRONMENT_SID)" ]]


get-verify-sid:
	$(eval VERIFY_SID := $(shell twilio api:verify:v2:services:list -o=json \
	| jq --raw-output '.[] | select(.friendlyName == "$(VERIFY_FNAME)") | .sid'))
	@if [[ ! -z "$(VERIFY_SID)" ]]; then \
      echo "VERIFY_SID=$(VERIFY_SID)"; \
    else \
	  echo "$@: Service named $(VERIFY_FNAME) is not deployed!!!"; \
	fi


make-service-editable: get-service-sid
	twilio api:serverless:v1:services:update --sid=$(SERVICE_SID) --ui-editable -o=json


deploy-service: get-verify-sid
	rm .twiliodeployinfo

	if [[ -z "$(VERIFY_SID)" ]]; then \
	  twilio api:verify:v2:services:create --friendly-name=$(VERIFY_FNAME) -o=json; \
    fi

	twilio serverless:deploy --runtime node14 --override-existing-project


# separate make target needed to be abortable
confirm-delete:
	@read -p "Delete $(SERVICE_UNAME) service? [y/n] " answer && [[ $${answer:-N} = y ]]


undeploy-service: confirm-delete get-service-sid get-verify-sid
	twilio api:serverless:v1:services:remove --sid $(SERVICE_SID)

	if [[ ! -z "$(VERIFY_SID)" ]]; then \
	  twilio api:verify:v2:services:remove --sid=$(VERIFY_FNAME) -o=json; \
    fi

	rm -f .twiliodeployinfo


get-flow-sid:
	$(eval FLOW_SID := $(shell twilio api:studio:v2:flows:list -o=json \
	| jq --raw-output '.[] | select(.friendlyName == "$(FLOW_FNAME)") | .sid'))


deploy-flow: get-flow-sid
	@if [[ -z "$(FLOW_FNAME)" || -z "$(FLOW_DEFINITION_FILE)" ]]; then \
  	  echo 'Usage: make deploy-flow FLOW_FNAME={your-flow-fname} FLOW_DEFINITION_FILE={path-to-flow-json-file}'; \
  	  exit 1; \
  	fi

	@echo "validating flow definition for flow=$(FLOW_FNAME)"
	twilio api:studio:v2:flows:validate:create \
	   --friendly-name $(FLOW_FNAME) \
	   --status 'published' \
	   --definition "`cat $(FLOW_DEFINITION_FILE)`"

	@if [[ -z "$(FLOW_SID)" ]]; then \
	  echo "creating flow=$(FLOW_FNAME)"; \
	  twilio api:studio:v2:flows:create \
	  --friendly-name $(FLOW_FNAME) \
	  --status 'published' \
	  --commit-message 'deployed via installer' \
	  --definition "`cat $(FLOW_DEFINITION_FILE)`"; \
    else \
	  echo "updating flow=$(FLOW_FNAME)"; \
	  twilio api:studio:v2:flows:update \
	  --sid $(FLOW_SID) \
	  --status 'published' \
	  --commit-message 'deployed via installer' \
	  --definition "`cat $(FLOW_DEFINITION_FILE)`"; \
    fi


undeploy-flow: get-flow-sid
	@if [[ -z "$(FLOW_FNAME)" ]]; then \
  	  echo 'Usage: make deploy-flow FLOW_FNAME={your-flow-fname}'; \
	  exit 1; \
	fi

	echo "deleting flow=$(FLOW_FNAME)";
	twilio api:studio:v2:flows:remove --sid $(FLOW_SID)


deploy-all:  deploy-service make-service-editable
	@echo deployed and configured!


undeploy-all: undeploy-service
	@echo undeployed!


run-serverless:
	@if [[ ! -f .env.localhost ]]; then \
      echo "missing .env.localhost, creating from .env ..."; \
      cp .env .env.localhost; \
    fi
	@[[ -f .env.localhost ]]
	sed -i '' '/^ACCOUNT_SID/d' .env.localhost
	sed -i '' '/^AUTH_TOKEN/d' .env.localhost
	sed -i '' '/^DISABLE_AUTH_FOR_LOCALHOST/d' .env.localhost
	sed -i '' "1s/^/DISABLE_AUTH_FOR_LOCALHOST=true\\n/" .env.localhost
	sed -i '' "1s/^/ACCOUNT_SID=${TWILIO_ACCOUNT_SID}\\n/" .env.localhost
	sed -i '' "1s/^/AUTH_TOKEN=${TWILIO_AUTH_TOKEN}\\n/" .env.localhost
	npm install
	twilio serverless:start --env=.env.localhost


tail-log: get-service-sid get-environment-sid
	twilio serverless:logs --service-sid=$(SERVICE_SID) --environment=$(ENVIRONMENT_SID) --tail


retrieve-flow-executions: get-flow-sid
	@if [[ -z "$(FLOW_FNAME)" ]]; then \
  	  echo 'Usage: make retrieve-flow-executions FLOW_FNAME={your-flow-fname}'; \
	  exit 1; \
	fi
